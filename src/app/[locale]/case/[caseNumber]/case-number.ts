/** Turns the URL segment into a case number, or null if it isn't one. */
export function parseCaseNumber(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  return Number(raw);
}
