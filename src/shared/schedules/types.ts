export const SCAN_INTERVALS = ["6h", "12h", "24h", "48h", "weekly", "disabled"] as const;

export type ScanInterval = (typeof SCAN_INTERVALS)[number];

export const INTERVAL_MS: Record<Exclude<ScanInterval, "disabled">, number> = {
    "6h": 6 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "48h": 48 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000
};
