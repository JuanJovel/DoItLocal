/**
 * The plain logic behind ReelBack: reading ffmpeg's description of a video and planning the
 * ffmpeg commands that play it backwards. Nothing here touches ffmpeg itself, so it is tested
 * directly.
 *
 * ffmpeg's `reverse` filter keeps every frame in memory until the input ends, and the browser
 * gives ffmpeg.wasm about 2 GB in total. So the video is reversed in short chunks: each chunk is
 * cut out on exact frame times, reversed and encoded, and the chunks are joined last-first. The
 * audio is small enough to reverse in one go, which also avoids clicks where chunks meet.
 */

export interface VideoInfo {
  /** Length in seconds. */
  duration: number;
  /** Timestamp of the first frame, in seconds. Usually 0, but not in every container. */
  start: number;
  /** Frames per second, when ffmpeg reports it. Only used to show progress. */
  fps: number | null;
  /** Picture size as it is shown, after any rotation the file asks for (phones record sideways). */
  width: number;
  height: number;
  hasAudio: boolean;
}

/** Tallest output picture. `original` keeps the size (rounded to even numbers for H.264). */
export type MaxHeight = 'original' | '1080' | '720' | '480';

export const MAX_HEIGHT_LABELS: Record<MaxHeight, string> = {
  original: 'Original size',
  '1080': 'Up to 1080p',
  '720': 'Up to 720p',
  '480': 'Up to 480p',
};

export type AudioMode = 'reverse' | 'remove';

export const AUDIO_LABELS: Record<AudioMode, string> = {
  reverse: 'Reverse the sound too',
  remove: 'Remove the sound',
};

export interface ReverseOptions {
  maxHeight: MaxHeight;
  audio: AudioMode;
}

/** Longest video ReelBack accepts. The reversed sound is held in memory in one piece. */
export const MAX_DURATION_SECONDS = 20 * 60;

/** Seconds read before a chunk starts, so the exact cut point is decoded rather than sought. */
const SEEK_MARGIN_SECONDS = 1;
/** Raw frames a chunk may hold in memory. Leaves room for the decoder, encoder and output. */
const FRAME_BUDGET_BYTES = 480 * 1024 * 1024;
/** Frame rate assumed when sizing chunks for a video whose frame rate ffmpeg did not report. */
const ASSUMED_FPS = 30;
const MIN_CHUNK_SECONDS = 1;
const MAX_CHUNK_SECONDS = 30;

export class VideoInfoError extends Error {
  override name = 'VideoInfoError';
}

/**
 * Read duration, picture size and whether there is sound from the log ffmpeg prints for
 * `ffmpeg -i <file>`, for example:
 *
 *   Duration: 00:00:12.48, start: 0.000000, bitrate: 2215 kb/s
 *   Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p, 1920x1080, ...
 *       displaymatrix: rotation of -90.00 degrees
 *   Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, ...
 */
export function parseVideoInfo(log: string): VideoInfo {
  const duration = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(log);
  // Skip cover art: a still picture attached to the file is a "video" stream too.
  const video = log
    .split('\n')
    .find((line) => /Stream #\d+:\d+.*: Video: /.test(line) && !line.includes('attached pic'));
  const size = video && /\b(\d{2,5})x(\d{2,5})\b/.exec(video);

  if (!video) throw new VideoInfoError('This file has no video in it.');
  if (!duration || !size) throw new VideoInfoError('This video could not be read.');

  const seconds =
    Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number.parseFloat(duration[3] ?? '0');
  if (!(seconds > 0)) throw new VideoInfoError('This video has no length.');

  // ffmpeg turns such a video upright while decoding, so a quarter turn swaps the sides.
  const rotation = /rotation of (-?[\d.]+) degrees/.exec(log);
  const sideways = rotation !== null && Math.abs(Math.round(Number(rotation[1]) / 90)) % 2 === 1;
  const [width, height] = [Number(size[1]), Number(size[2])];
  const start = /Duration:[^\n]*start:\s*(-?\d+(?:\.\d+)?)/.exec(log);
  const fps = /([\d.]+) fps\b/.exec(video);

  return {
    duration: seconds,
    start: start ? Number(start[1]) : 0,
    fps: fps && Number(fps[1]) > 0 ? Number(fps[1]) : null,
    width: sideways ? height : width,
    height: sideways ? width : height,
    hasAudio: /Stream #\d+:\d+.*: Audio: /.test(log),
  };
}

/** The output picture size for the chosen limit: never upscaled, always even. */
export function outputSize(
  { width, height }: Pick<VideoInfo, 'width' | 'height'>,
  maxHeight: MaxHeight,
): { width: number; height: number } {
  const limit = maxHeight === 'original' ? height : Math.min(height, Number(maxHeight));
  const even = (n: number): number => Math.max(2, 2 * Math.round(n / 2));
  return { width: even((width * limit) / height), height: even(limit) };
}

/**
 * Seconds of video per chunk, so one chunk's frames fit the memory budget. A 60 or 240 fps
 * video has that many times more frames per second, so its chunks are that much shorter.
 */
export function chunkSeconds(
  size: { width: number; height: number },
  fps: number | null = null,
): number {
  // A yuv420p frame takes 1.5 bytes per pixel.
  const perSecond = size.width * size.height * 1.5 * (fps ?? ASSUMED_FPS);
  const seconds = Math.floor(FRAME_BUDGET_BYTES / perSecond);
  return Math.min(MAX_CHUNK_SECONDS, Math.max(MIN_CHUNK_SECONDS, seconds));
}

export interface Chunk {
  /** Start time in the original video, in seconds. */
  start: number;
  length: number;
}

/**
 * Split `duration` into chunks of at most `size` seconds, in the order they appear in the
 * reversed video: the end of the original first. A short leftover is folded into its neighbor
 * rather than becoming a chunk of a few frames.
 */
export function planChunks(duration: number, size: number): Chunk[] {
  const count = Math.max(1, Math.round(duration / size));
  const length = duration / count;
  const chunks: Chunk[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = round(i * length);
    const end = i === count - 1 ? duration : round((i + 1) * length);
    chunks.push({ start, length: round(end - start) });
  }
  return chunks;
}

function round(seconds: number): number {
  return Math.round(seconds * 1000) / 1000;
}

/** The `-vf` filter chain: resize first, so the reverse filter stores the smaller frames. */
export function videoFilter(size: { width: number; height: number }): string {
  return `scale=${size.width}:${size.height}:flags=bicubic,setsar=1,reverse`;
}

const VIDEO_CODEC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p'];

/**
 * ffmpeg arguments that reverse one chunk of the video, without sound.
 *
 * Seeking with `-ss` alone keeps the frame that straddles the cut, so neighboring chunks would
 * share a frame. Instead ffmpeg seeks a little early and keeps the original timestamps
 * (`-copyts`), and the `trim` filter cuts on exact frame times: each frame lands in one chunk.
 */
export function chunkArgs(
  input: string,
  chunk: Chunk,
  info: Pick<VideoInfo, 'start'>,
  size: { width: number; height: number },
  output: string,
): string[] {
  const from = info.start + chunk.start;
  const to = from + chunk.length;
  const seek = Math.max(0, chunk.start - SEEK_MARGIN_SECONDS);
  const read = chunk.start + chunk.length - seek + SEEK_MARGIN_SECONDS;
  return [
    ...['-ss', String(round(seek)), '-t', String(round(read)), '-copyts', '-i', input],
    ...['-map', '0:v:0', '-an', '-sn', '-dn'],
    ...[
      '-vf',
      `trim=start=${round(from)}:end=${round(to)},setpts=PTS-STARTPTS,${videoFilter(size)}`,
    ],
    ...VIDEO_CODEC,
    output,
  ];
}

/** ffmpeg arguments that reverse the whole sound track. */
export function audioArgs(input: string, output: string): string[] {
  return [
    ...['-i', input, '-map', '0:a:0', '-vn', '-sn', '-dn', '-af', 'areverse'],
    ...['-c:a', 'aac', '-b:a', '160k', output],
  ];
}

/** The concat demuxer's list file. Names are ours (no quotes or newlines), so no escaping. */
export function concatList(files: string[]): string {
  return files.map((file) => `file '${file}'\n`).join('');
}

/** ffmpeg arguments that join the reversed chunks (and the reversed sound) without re-encoding. */
export function joinArgs(list: string, audio: string | null, output: string): string[] {
  return [
    ...['-f', 'concat', '-safe', '0', '-i', list],
    ...(audio ? ['-i', audio, '-map', '0:v:0', '-map', '1:a:0', '-shortest'] : ['-map', '0:v:0']),
    ...['-c', 'copy', '-movflags', '+faststart', output],
  ];
}

/**
 * Seconds of output written so far, read from ffmpeg's status line
 * ("frame=  120 fps= 24 q=28.0 size=  1024kB time=00:00:04.00 bitrate=...").
 */
export function parseProgressTime(line: string): number | null {
  const match = /time=\s*(-?)(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
  if (!match || match[1] === '-') return null;
  return Number(match[2]) * 3600 + Number(match[3]) * 60 + Number.parseFloat(match[4] ?? '0');
}

const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|qt|webm|mkv|avi|3gp|3g2|mpe?g|ts|mts|m2ts|wmv|flv|ogv)$/i;

/** Whether a picked or dropped file looks like a video, by its type or, failing that, its name. */
export function isVideoFile(file: { name: string; type: string }): boolean {
  return file.type.startsWith('video/') || VIDEO_EXTENSIONS.test(file.name);
}

/** Frames written so far, from ffmpeg's status line ("frame=  120 fps= 24 ..."). */
export function parseProgressFrame(line: string): number | null {
  const match = /frame=\s*(\d+)/.exec(line);
  return match ? Number(match[1]) : null;
}

/** "clip.mov" -> "clip-reversed.mp4". */
export function reversedName(fileName: string): string {
  const base = fileName.replace(/\.[^.]*$/, '') || 'video';
  return `${base}-reversed.mp4`;
}

/** "75.4" -> "1:15", "3725" -> "1:02:05". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
