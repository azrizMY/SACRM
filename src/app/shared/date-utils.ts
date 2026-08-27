/**
 * Local-calendar date formatting. `Date#toISOString()` converts to UTC first, which can
 * roll the date backward by one day for any timezone ahead of UTC — that silently shifted
 * month-bucket keys and "today" strings, throwing off date-range filters and the dashboard's
 * monthly trend. Every date string in the app should be built from these instead.
 */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toLocalDateStr(new Date());
}
