export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** Returns today's date as an ISO 8601 date string (YYYY-MM-DD). */
export function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}
