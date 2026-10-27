import { describe, expect, it } from 'vitest';
import {
  audioArgs,
  chunkArgs,
  chunkSeconds,
  concatList,
  formatDuration,
  isVideoFile,
  joinArgs,
  outputSize,
  parseProgressFrame,
  parseProgressTime,
  parseVideoInfo,
  planChunks,
  reversedName,
  VideoInfoError,
} from './reverse';

const PHONE_LOG = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/input/clip.mov':
  Metadata:
    major_brand     : qt
  Duration: 00:01:02.48, start: 0.000000, bitrate: 15862 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709), 1920x1080, 15700 kb/s, 29.97 fps, 29.97 tbr, 600 tbn (default)
      Metadata:
        handler_name    : Core Media Video
      Side data:
        displaymatrix: rotation of -90.00 degrees
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, mono, fltp, 94 kb/s (default)
At least one output file must be specified`;

const SILENT_WEBM_LOG = `Input #0, matroska,webm, from '/input/screen.webm':
  Duration: 00:00:07.25, start: 1.400000, bitrate: 512 kb/s
  Stream #0:0: Video: vp9 (Profile 0), yuv420p(tv), 1280x720, SAR 1:1 DAR 16:9, 30 fps, 30 tbr, 1k tbn
At least one output file must be specified`;

describe('parseVideoInfo', () => {
  it('reads duration, size and sound, turning sideways phone videos upright', () => {
    expect(parseVideoInfo(PHONE_LOG)).toEqual({
      duration: 62.48,
      start: 0,
      fps: 29.97,
      width: 1080,
      height: 1920,
      hasAudio: true,
    });
  });

  it('handles a video without sound', () => {
    expect(parseVideoInfo(SILENT_WEBM_LOG)).toEqual({
      duration: 7.25,
      start: 1.4,
      fps: 30,
      width: 1280,
      height: 720,
      hasAudio: false,
    });
  });

  it('ignores cover art and rejects files with no real video', () => {
    const music = `  Duration: 00:03:10.00, start: 0.000000, bitrate: 320 kb/s
  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 320 kb/s
  Stream #0:1: Video: mjpeg (Baseline), yuvj420p(pc), 600x600, 90k tbr (attached pic)`;
    expect(() => parseVideoInfo(music)).toThrow(VideoInfoError);
    expect(() => parseVideoInfo(music)).toThrow(/no video/);
  });

  it('rejects logs it cannot make sense of', () => {
    expect(() => parseVideoInfo('/input/x.mp4: Invalid data found when processing input')).toThrow(
      VideoInfoError,
    );
    expect(() => parseVideoInfo(SILENT_WEBM_LOG.replace('00:00:07.25', 'N/A'))).toThrow(
      VideoInfoError,
    );
  });
});

describe('outputSize', () => {
  it('keeps the original size, rounded to even numbers', () => {
    expect(outputSize({ width: 1281, height: 721 }, 'original')).toEqual({
      width: 1282,
      height: 722,
    });
  });

  it('scales down to the limit, keeping the aspect ratio', () => {
    expect(outputSize({ width: 3840, height: 2160 }, '720')).toEqual({ width: 1280, height: 720 });
    expect(outputSize({ width: 1080, height: 1920 }, '1080')).toEqual({ width: 608, height: 1080 });
  });

  it('never scales up', () => {
    expect(outputSize({ width: 640, height: 360 }, '1080')).toEqual({ width: 640, height: 360 });
  });
});

describe('chunkSeconds', () => {
  it('uses shorter chunks for bigger pictures', () => {
    const hd = chunkSeconds({ width: 1920, height: 1080 });
    const sd = chunkSeconds({ width: 854, height: 480 });
    expect(hd).toBeGreaterThanOrEqual(1);
    expect(sd).toBeGreaterThan(hd);
  });

  it('stays between 1 and 30 seconds', () => {
    expect(chunkSeconds({ width: 7680, height: 4320 })).toBe(1);
    expect(chunkSeconds({ width: 160, height: 90 })).toBe(30);
  });
});

describe('planChunks', () => {
  it('covers the whole video, end first, without gaps', () => {
    const chunks = planChunks(23, 5);
    expect(chunks.map((c) => c.start)).toEqual([18.4, 13.8, 9.2, 4.6, 0]);
    expect(chunks[0]).toEqual({ start: 18.4, length: 4.6 });
    for (let i = 1; i < chunks.length; i++) {
      const later = chunks[i - 1];
      const chunk = chunks[i];
      expect(chunk && later && chunk.start + chunk.length).toBeCloseTo(later?.start ?? NaN, 6);
    }
    expect(chunks.reduce((sum, c) => sum + c.length, 0)).toBeCloseTo(23, 6);
  });

  it('uses one chunk for a short video', () => {
    expect(planChunks(2.5, 10)).toEqual([{ start: 0, length: 2.5 }]);
  });

  it('never makes a sliver of a chunk', () => {
    const chunks = planChunks(10.2, 5);
    expect(chunks).toHaveLength(2);
    expect(Math.min(...chunks.map((c) => c.length))).toBeGreaterThan(5);
  });
});

describe('ffmpeg arguments', () => {
  it('reverses one chunk of video, cut on exact frame times, with the frames resized first', () => {
    const args = chunkArgs(
      '/input/a.mp4',
      { start: 5, length: 5 },
      { start: 1.4 },
      { width: 1280, height: 720 },
      'p.mp4',
    );
    // Seek a second early and keep the original timestamps, so trim decides the cut.
    expect(args.slice(0, 7)).toEqual(['-ss', '4', '-t', '7', '-copyts', '-i', '/input/a.mp4']);
    expect(args).toContain('-an');
    expect(args[args.indexOf('-vf') + 1]).toBe(
      'trim=start=6.4:end=11.4,setpts=PTS-STARTPTS,scale=1280:720:flags=bicubic,setsar=1,reverse',
    );
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264');
    expect(args.at(-1)).toBe('p.mp4');
  });

  it('never seeks before the start of the file', () => {
    const args = chunkArgs(
      '/in',
      { start: 0.4, length: 2 },
      { start: 0 },
      { width: 2, height: 2 },
      'o',
    );
    expect(args.slice(0, 4)).toEqual(['-ss', '0', '-t', '3.4']);
  });

  it('reverses the sound in one pass', () => {
    const args = audioArgs('/input/a.mp4', 's.m4a');
    expect(args[args.indexOf('-af') + 1]).toBe('areverse');
    expect(args).toContain('-vn');
    expect(args.at(-1)).toBe('s.m4a');
  });

  it('joins the parts without re-encoding, with or without sound', () => {
    expect(joinArgs('l.txt', 's.m4a', 'o.mp4')).toEqual([
      ...['-f', 'concat', '-safe', '0', '-i', 'l.txt', '-i', 's.m4a'],
      ...['-map', '0:v:0', '-map', '1:a:0', '-shortest'],
      ...['-c', 'copy', '-movflags', '+faststart', 'o.mp4'],
    ]);
    expect(joinArgs('l.txt', null, 'o.mp4')).not.toContain('1:a:0');
  });

  it('writes a concat list in the given order', () => {
    expect(concatList(['b.mp4', 'a.mp4'])).toBe("file 'b.mp4'\nfile 'a.mp4'\n");
  });
});

describe('parseProgressFrame', () => {
  it('reads the frame count from ffmpeg status lines', () => {
    expect(parseProgressFrame('frame=  120 fps= 24 q=28.0 size=  1024kB time=00:00:00.00')).toBe(
      120,
    );
    expect(parseProgressFrame('Stream mapping:')).toBeNull();
  });
});

describe('parseProgressTime', () => {
  it('reads the time from ffmpeg status lines', () => {
    expect(
      parseProgressTime('frame=  120 fps= 24 q=28.0 size=  1024kB time=00:01:04.50 bitrate=1.2'),
    ).toBe(64.5);
  });

  it('ignores other lines and negative times', () => {
    expect(parseProgressTime('Stream mapping:')).toBeNull();
    expect(parseProgressTime('size=0kB time=-00:00:00.02 bitrate=N/A')).toBeNull();
  });
});

describe('file helpers', () => {
  it('recognizes videos by type or by name', () => {
    expect(isVideoFile({ name: 'a', type: 'video/mp4' })).toBe(true);
    expect(isVideoFile({ name: 'clip.MKV', type: '' })).toBe(true);
    expect(isVideoFile({ name: 'song.mp3', type: 'audio/mpeg' })).toBe(false);
  });

  it('names the reversed file after the original', () => {
    expect(reversedName('Holiday clip.MOV')).toBe('Holiday clip-reversed.mp4');
    expect(reversedName('noext')).toBe('noext-reversed.mp4');
    expect(reversedName('.mp4')).toBe('video-reversed.mp4');
  });

  it('formats durations like a video player', () => {
    expect(formatDuration(7.4)).toBe('0:07');
    expect(formatDuration(75.4)).toBe('1:15');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});
