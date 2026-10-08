/** Limit `value` to the range from `min` to `max` (both inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
