import { describe, expect, it } from 'vitest';
import { inspectImage } from './inspect';
import { fileOf, makeImage } from './test-helpers';

const outcome = async (file: File, decodes = async () => true): Promise<string> => {
  const result = await inspectImage(file, decodes);
  return 'problem' in result ? result.problem.code : result.info.kind;
};

describe('inspectImage', () => {
  it('accepts JPEG and PNG without decoding them', async () => {
    const never = async (): Promise<boolean> => {
      throw new Error('should not decode');
    };
    expect(await outcome(fileOf(makeImage('jpeg', 4, 4), 'a.jpg'), never)).toBe('jpeg');
    expect(await outcome(fileOf(makeImage('png', 4, 4), 'a.png'), never)).toBe('png');
  });

  it('judges by content, not by name', async () => {
    expect(await outcome(fileOf(makeImage('png', 4, 4), 'photo.jpg'))).toBe('png');
    expect(await outcome(fileOf('just text', 'photo.jpg'))).toBe('not-image');
  });

  it('points PDFs to PDFold', async () => {
    const result = await inspectImage(fileOf('%PDF-1.7\n...', 'doc.pdf'));
    expect('problem' in result && result.problem.message).toMatch(/PDFold/);
  });

  it('rejects empty files', async () => {
    expect(await outcome(fileOf('', 'empty.jpg'))).toBe('empty');
  });

  it('checks that the browser can open other formats', async () => {
    const heic = fileOf(
      new Uint8Array([0, 0, 0, 24, ...new TextEncoder().encode('ftypheic')]),
      'a.heic',
    );
    expect(await outcome(heic, async () => true)).toBe('heic');
    const result = await inspectImage(heic, async () => false);
    expect('problem' in result && result.problem).toMatchObject({
      code: 'unsupported',
      message: expect.stringMatching(/Safari/),
    });
  });
});
