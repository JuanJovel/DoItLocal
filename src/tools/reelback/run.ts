import { FFFSType, FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import { JobError, type JobProgress } from '../../file-queue/job';
import {
  audioArgs,
  chunkArgs,
  chunkSeconds,
  concatList,
  joinArgs,
  MAX_DURATION_SECONDS,
  outputSize,
  parseProgressFrame,
  parseProgressTime,
  parseVideoInfo,
  planChunks,
  VideoInfoError,
  type ReverseOptions,
  type VideoInfo,
} from './reverse';

/** Fetch ffmpeg.wasm (about 30 MB) ahead of time, so the first run starts sooner. */
export function preloadFfmpeg(): void {
  void fetch(wasmURL).catch(() => undefined);
}

export interface ReverseResult {
  bytes: Uint8Array;
  info: VideoInfo;
}

export interface ReverseJob {
  result: Promise<ReverseResult>;
  /** Stops ffmpeg at once. `result` rejects with a "cancelled" JobError. */
  cancel: () => void;
}

const INPUT_DIR = '/input';
/** Share of the progress bar for the sound and the final join; the video chunks get the rest. */
const AUDIO_SHARE = 0.08;
const JOIN_SHARE = 0.02;

/**
 * Reverse a video with ffmpeg.wasm in its own worker. A fresh ffmpeg is started for every video
 * and shut down afterwards, which hands all of its memory back to the browser.
 *
 * The file is mounted read-only (WORKERFS) rather than copied into ffmpeg's memory, so even a
 * large video costs nothing until it is decoded.
 */
export function reverseVideo(
  file: File,
  options: ReverseOptions,
  onProgress: (progress: JobProgress) => void,
): ReverseJob {
  const ffmpeg = new FFmpeg();
  let cancelled = false;
  let log: string[] = [];
  /** Receives every log line of the running command, to read its progress from. */
  let onStatus: ((line: string) => void) | null = null;

  ffmpeg.on('log', ({ message }) => {
    log.push(message);
    if (log.length > 400) log = log.slice(-200);
    onStatus?.(message);
  });

  /** Run one ffmpeg command; a non-zero exit becomes a JobError with ffmpeg's last words. */
  async function exec(args: string[], what: string): Promise<void> {
    log = [];
    const code = await ffmpeg.exec(['-hide_banner', '-nostdin', '-y', ...args]);
    if (code !== 0) {
      console.warn(`ffmpeg failed while ${what}:\n${log.slice(-15).join('\n')}`);
      throw new JobError('failed', explainFailure(log, what));
    }
  }

  async function run(): Promise<ReverseResult> {
    onProgress({ fraction: 0, label: 'Loading ffmpeg…' });
    await ffmpeg.load({ coreURL, wasmURL });
    await ffmpeg.createDir(INPUT_DIR);
    let input = `${INPUT_DIR}/${file.name}`;
    if (!(await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, INPUT_DIR))) {
      // A build without WORKERFS: copy the file in instead.
      input = `${INPUT_DIR}/input`;
      await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    }

    onProgress({ fraction: 0, label: 'Reading the video…' });
    log = [];
    // With no output file ffmpeg prints what it found and exits with an error, as intended.
    await ffmpeg.exec(['-hide_banner', '-i', input]);
    let info: VideoInfo;
    try {
      info = parseVideoInfo(log.join('\n'));
    } catch (error) {
      throw new JobError(
        'unreadable',
        error instanceof VideoInfoError
          ? `${error.message} Try an MP4, MOV, WebM or MKV video.`
          : 'This video could not be read.',
      );
    }
    if (info.duration > MAX_DURATION_SECONDS) {
      throw new JobError(
        'too-long',
        `This video is ${Math.round(info.duration / 60)} minutes long. ReelBack can reverse videos up to ${MAX_DURATION_SECONDS / 60} minutes; trim it first.`,
      );
    }

    const size = outputSize(info, options.maxHeight);
    const chunks = planChunks(info.duration, chunkSeconds(size, info.fps));
    const withAudio = info.hasAudio && options.audio === 'reverse';
    const videoShare = 1 - JOIN_SHARE - (withAudio ? AUDIO_SHARE : 0);
    let doneSeconds = 0;

    const parts: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const label =
        chunks.length === 1
          ? 'Reversing the video…'
          : `Reversing part ${index + 1} of ${chunks.length}…`;
      const report = (seconds: number): void =>
        onProgress({
          fraction: (videoShare * (doneSeconds + Math.min(seconds, chunk.length))) / info.duration,
          label,
        });
      report(0);
      // The reversed frames come out only after the whole chunk is read, so count them.
      const fps = info.fps;
      onStatus = (line) => {
        const frames = fps && parseProgressFrame(line);
        if (fps && frames) report(frames / fps);
      };
      const part = `part-${String(index).padStart(4, '0')}.mp4`;
      await exec(chunkArgs(input, chunk, info, size, part), 'reversing the video');
      parts.push(part);
      doneSeconds += chunk.length;
    }

    let audio: string | null = null;
    if (withAudio) {
      const label = 'Reversing the sound…';
      onStatus = (line) => {
        const seconds = parseProgressTime(line);
        if (seconds === null) return;
        onProgress({
          fraction: videoShare + (AUDIO_SHARE * Math.min(seconds, info.duration)) / info.duration,
          label,
        });
      };
      onProgress({ fraction: videoShare, label });
      audio = 'sound.m4a';
      await exec(audioArgs(input, audio), 'reversing the sound');
    }

    onStatus = null;
    onProgress({ fraction: 1 - JOIN_SHARE, label: 'Putting it together…' });
    await ffmpeg.writeFile('parts.txt', concatList(parts));
    await exec(joinArgs('parts.txt', audio, 'reversed.mp4'), 'joining the video');
    // The parts and the sound now live in reversed.mp4. Free them before the result is copied out,
    // so a long video does not hold three copies of itself in memory at once.
    const joined = [...parts, 'parts.txt', ...(audio ? [audio] : [])];
    await Promise.allSettled(joined.map((name) => ffmpeg.deleteFile(name)));
    const bytes = await ffmpeg.readFile('reversed.mp4');
    if (typeof bytes === 'string') throw new JobError('failed', 'ffmpeg returned no video.');
    onProgress({ fraction: 1, label: 'Done' });
    return { bytes, info };
  }

  const result = run()
    .catch((error: unknown) => {
      if (cancelled) throw new JobError('cancelled', 'Cancelled.');
      if (error instanceof JobError) throw error;
      console.warn('ReelBack failed:', error);
      throw new JobError('failed', explainFailure(log, 'reversing the video'));
    })
    .finally(() => ffmpeg.terminate());

  return {
    result,
    cancel: () => {
      cancelled = true;
      ffmpeg.terminate();
    },
  };
}

/** A sentence for the person, from the tail of ffmpeg's log. */
function explainFailure(log: string[], what: string): string {
  const tail = log.slice(-30).join('\n');
  if (/out of memory|Cannot allocate memory|memory access out of bounds/i.test(tail)) {
    return `Your browser ran out of memory while ${what}. Pick a smaller size under "Size" and try again.`;
  }
  if (/Invalid data found|could not find codec|Decoder .* not found|Unknown decoder/i.test(tail)) {
    return 'This video uses a format ReelBack cannot read. Try an MP4, MOV, WebM or MKV video.';
  }
  return `Something went wrong while ${what}. Try a smaller size, or a shorter video.`;
}
