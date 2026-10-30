import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These tests drive `reverseVideo` against a stand-in for ffmpeg.wasm that keeps an in-memory
 * file system and plays back a scripted report of the video, so the runner's own decisions are
 * checked without downloading 30 MB of WebAssembly.
 */
const fake = vi.hoisted(() => {
  type Listener = (event: { message: string }) => void;

  const state = {
    /** What `ffmpeg -i <file>` prints. */
    probe: [] as string[],
    /** Arguments of every command that writes a file. */
    commands: [] as string[][],
    /** ffmpeg's in-memory files. */
    files: new Map<string, Uint8Array>(),
    /** The file names present each time a file was read back. */
    readBack: [] as string[][],
  };

  class FFmpeg {
    #listeners: Listener[] = [];

    on(event: string, listener: Listener): void {
      if (event === 'log') this.#listeners.push(listener);
    }
    private print(lines: string[]): void {
      for (const message of lines) for (const listener of this.#listeners) listener({ message });
    }
    async load(): Promise<boolean> {
      return true;
    }
    async createDir(): Promise<boolean> {
      return true;
    }
    async mount(): Promise<boolean> {
      return true;
    }
    async writeFile(name: string, data: string | Uint8Array): Promise<boolean> {
      state.files.set(name, typeof data === 'string' ? new TextEncoder().encode(data) : data);
      return true;
    }
    async exec(args: string[]): Promise<number> {
      // The runner adds -y to every command that writes a file; reading the video has none.
      if (!args.includes('-y')) {
        this.print(state.probe);
        return 1;
      }
      state.commands.push(args);
      this.print(['frame=   10 fps= 24 q=28.0 size=  64kB time=00:00:00.33 bitrate= 1.0kbits/s']);
      state.files.set(args[args.length - 1] ?? '', new Uint8Array(8));
      return 0;
    }
    async readFile(name: string): Promise<Uint8Array> {
      state.readBack.push([...state.files.keys()]);
      const data = state.files.get(name);
      if (!data) throw new Error(`No such file: ${name}`);
      return data;
    }
    async deleteFile(name: string): Promise<boolean> {
      if (!state.files.delete(name)) throw new Error(`No such file: ${name}`);
      return true;
    }
    terminate(): void {}
  }

  return { state, FFmpeg };
});

vi.mock('@ffmpeg/ffmpeg', () => ({ FFmpeg: fake.FFmpeg, FFFSType: { WORKERFS: 'WORKERFS' } }));

import { reverseVideo } from './run';

interface Report {
  duration?: string;
  fps?: number;
  size?: string;
  audio?: boolean;
  /** Chapter lines between the duration and the streams, as in a long recording. */
  chapters?: number;
}

/** The text `ffmpeg -i` prints, in the order ffmpeg prints it. */
function report({
  duration = '00:00:20.00',
  fps = 30,
  size = '1920x1080',
  audio = false,
  chapters = 0,
}: Report): string[] {
  return [
    "Input #0, mov,mp4,m4a,3gp,3g2,mj2, from '/input/clip.mp4':",
    `  Duration: ${duration}, start: 0.000000, bitrate: 8000 kb/s`,
    ...Array.from(
      { length: chapters },
      (_, i) => `  Chapter #0:${i}: start ${i}.000000, end ${i + 1}.000000`,
    ),
    `  Stream #0:0[0x1](und): Video: h264 (High), yuv420p, ${size}, 8000 kb/s, ${fps} fps, ${fps} tbr, 15360 tbn (default)`,
    ...(audio
      ? ['  Stream #0:1[0x2](und): Audio: aac (LC), 48000 Hz, stereo, fltp, 128 kb/s (default)']
      : []),
  ];
}

const clip = (): File => new File([new Uint8Array(16)], 'clip.mp4', { type: 'video/mp4' });

beforeEach(() => {
  fake.state.probe = [];
  fake.state.commands = [];
  fake.state.files.clear();
  fake.state.readBack = [];
});

describe('reverseVideo', () => {
  it('keeps the frames of each chunk within the memory budget at 60 fps', async () => {
    fake.state.probe = report({ fps: 60 });

    await reverseVideo(clip(), { maxHeight: '1080', audio: 'remove' }, () => {}).result;

    const chunks = fake.state.commands.filter((args) => args.includes('-vf'));
    expect(chunks.length).toBeGreaterThan(1);
    for (const args of chunks) {
      const trim = /trim=start=([\d.]+):end=([\d.]+)/.exec(args[args.indexOf('-vf') + 1] ?? '');
      const seconds = Number(trim?.[2]) - Number(trim?.[1]);
      const frameBytes = 1920 * 1080 * 1.5;
      // The runner's budget for the raw frames of one chunk is 480 MiB.
      expect(seconds * 60 * frameBytes).toBeLessThanOrEqual(480 * 1024 * 1024);
    }
  });

  it('frees the chunks and the sound before the result is read back', async () => {
    fake.state.probe = report({ audio: true });

    await reverseVideo(clip(), { maxHeight: '1080', audio: 'reverse' }, () => {}).result;

    expect(fake.state.commands.some((args) => args.at(-1) === 'sound.m4a')).toBe(true);
    expect(fake.state.readBack).toHaveLength(1);
    expect(fake.state.readBack[0]).toEqual(['reversed.mp4']);
  });

  it('reads the video even when ffmpeg lists hundreds of chapters', async () => {
    fake.state.probe = report({ chapters: 600 });

    const { info } = await reverseVideo(clip(), { maxHeight: '1080', audio: 'remove' }, () => {})
      .result;

    expect(info.duration).toBe(20);
    expect(info.width).toBe(1920);
  });
});
