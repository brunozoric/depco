import { DAY_MS } from "#shared/time.js";

export const RANGE_DAYS: Record<string, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90
};

export function daysToCutoff(days: string | undefined): string | undefined {
    if (!days) {
        return undefined;
    }
    const cutoff = new Date(Date.now() - Number(days) * DAY_MS).toISOString().slice(0, 10);
    return cutoff;
}
