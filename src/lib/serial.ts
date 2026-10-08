/**
 * Returns a runner that executes async tasks one at a time, in call order.
 * A failing task rejects its own promise but never blocks the ones queued behind it.
 */
export function serialRunner(): <T>(task: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
}
