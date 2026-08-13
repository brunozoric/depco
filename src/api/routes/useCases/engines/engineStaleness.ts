/** Stale after this much time has elapsed since the last scan, unless a newer Node.js release has already made it stale sooner. */
export const ENGINE_STALENESS_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

export type IEngineScanStaleReason = "time" | "release" | "both";

export interface IComputeEngineStalenessInput {
    lastScannedAt: number | null;
    maxReleaseDate: number;
    now: number;
    thresholdMs: number;
}

export interface IEngineStalenessResult {
    engineScanStale: boolean;
    engineScanStaleReason: IEngineScanStaleReason | null;
}

/** Same staleness rules as EngineService.getSummary(): stale after `thresholdMs` of inactivity, or once a newer Node.js release has shipped since the last scan. */
export function computeEngineStaleness(
    input: IComputeEngineStalenessInput
): IEngineStalenessResult {
    const { lastScannedAt, maxReleaseDate, now, thresholdMs } = input;
    if (lastScannedAt === null) {
        return { engineScanStale: false, engineScanStaleReason: null };
    }

    const isTimeStale = lastScannedAt < now - thresholdMs;
    const isReleaseStale = lastScannedAt < maxReleaseDate;

    if (isTimeStale && isReleaseStale) {
        return { engineScanStale: true, engineScanStaleReason: "both" };
    }
    if (isTimeStale) {
        return { engineScanStale: true, engineScanStaleReason: "time" };
    }
    if (isReleaseStale) {
        return { engineScanStale: true, engineScanStaleReason: "release" };
    }
    return { engineScanStale: false, engineScanStaleReason: null };
}
