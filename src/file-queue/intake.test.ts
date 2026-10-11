import { describe, expect, it } from 'vitest';
import { createIntake, describeIntake, type Inspection } from './intake';
import { FileQueue } from './store';

type Info = { pages: number };

const file = (name: string): File => new File(['x'], name);
const ok = (pages = 1): Inspection<Info> => ({ info: { pages } });
const bad = (message: string): Inspection<Info> => ({ problem: { code: 'bad', message } });

describe('createIntake', () => {
  it('marks files ready with what the check learned', async () => {
    const queue = new FileQueue<Info>();
    const intake = createIntake(queue, async () => ok(7));

    const summary = await intake.addFiles([file('a.pdf')]);

    expect(summary).toMatchObject({ added: 1, ok: 1, failed: [] });
    expect(queue.items[0]).toMatchObject({ status: 'ready', info: { pages: 7 } });
  });

  it('keeps going when some files are bad: errors are per file', async () => {
    const queue = new FileQueue<Info>();
    const intake = createIntake(queue, async (f) =>
      f.name.startsWith('bad') ? bad(`${f.name} is broken`) : ok(),
    );

    const summary = await intake.addFiles(['one', 'bad-a', 'two', 'bad-b'].map(file));

    expect(summary.ok).toBe(2);
    expect(summary.failed.map((f) => f.name)).toEqual(['bad-a', 'bad-b']);
    // The queue keeps its order and the good files are still usable.
    expect(queue.items.map((i) => i.name)).toEqual(['one', 'bad-a', 'two', 'bad-b']);
    expect(queue.ready.map((i) => i.name)).toEqual(['one', 'two']);
    expect(queue.items[1]?.problem?.message).toBe('bad-a is broken');
  });

  it('inspects files one at a time', async () => {
    const queue = new FileQueue<Info>();
    let active = 0;
    let maxActive = 0;
    const intake = createIntake(queue, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return ok();
    });

    await intake.addFiles(Array.from({ length: 8 }, (_, i) => file(`${i}.pdf`)));

    expect(maxActive).toBe(1);
    expect(queue.ready).toHaveLength(8);
  });

  it('does not resurrect a file removed while it was being inspected', async () => {
    const queue = new FileQueue<Info>();
    const intake = createIntake(queue, async () => {
      queue.remove(queue.items[0]!.id);
      return ok();
    });
    await intake.addFiles([file('a.pdf')]);
    expect(queue.items).toHaveLength(0);
  });
});

describe('describeIntake', () => {
  const problem = (message: string) => ({ code: 'corrupt', message });

  it('reports successes and the first few failures', () => {
    const text = describeIntake(
      {
        added: 6,
        ok: 2,
        failed: ['a', 'b', 'c', 'd'].map((name) => ({ name, problem: problem(`${name} bad.`) })),
      },
      'PDF',
    );
    expect(text).toBe('Added 2 PDFs. a: a bad. b: b bad. c: c bad. 1 more files had problems.');
  });

  it('is just the success line when everything worked', () => {
    expect(describeIntake({ added: 1, ok: 1, failed: [] }, 'image')).toBe('Added 1 image.');
  });
});
