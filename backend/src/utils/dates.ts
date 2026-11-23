/**
 * Day boundaries are computed in the user's local time. The client sends its
 * UTC offset (minutes, as returned by Date#getTimezoneOffset) via the
 * `x-tz-offset` header so "today" matches what the user sees.
 */
export function dayRange(dateStr: string | undefined, tzOffsetMin: number) {
  // getTimezoneOffset() is positive west of UTC, e.g. IST = -330.
  const start =
    dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
      ? new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() + tzOffsetMin * 60_000)
      : localMidnightUtc(new Date(), tzOffsetMin);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/** UTC instant of local midnight for the day containing `now`. */
export function localMidnightUtc(now: Date, tzOffsetMin: number) {
  const local = new Date(now.getTime() - tzOffsetMin * 60_000);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + tzOffsetMin * 60_000);
}

/** Local calendar date (YYYY-MM-DD) of an instant. */
export function localDateKey(d: Date, tzOffsetMin: number) {
  return new Date(d.getTime() - tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

export function parseTzOffset(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= 14 * 60 ? Math.round(n) : 0;
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * 86_400_000);
}
