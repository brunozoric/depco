import { describe, it, expect } from "vitest";
import { computeEngineStaleness, ENGINE_STALENESS_THRESHOLD_MS } from "../engineStaleness.js";

describe("computeEngineStaleness", () => {
    it("is not stale when there is no prior scan", () => {
        const result = computeEngineStaleness({
            lastScannedAt: null,
            maxReleaseDate: Date.now(),
            now: Date.now(),
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        expect(result).toEqual({ engineScanStale: false, engineScanStaleReason: null });
    });

    it("is fresh when scanned recently and no newer release has shipped", () => {
        const now = Date.now();
        const result = computeEngineStaleness({
            lastScannedAt: now - 1000,
            maxReleaseDate: now - 100_000,
            now,
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        expect(result).toEqual({ engineScanStale: false, engineScanStaleReason: null });
    });

    it("is not stale exactly at the threshold boundary", () => {
        const now = Date.now();
        const result = computeEngineStaleness({
            lastScannedAt: now - ENGINE_STALENESS_THRESHOLD_MS,
            maxReleaseDate: now - ENGINE_STALENESS_THRESHOLD_MS - 1,
            now,
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        expect(result).toEqual({ engineScanStale: false, engineScanStaleReason: null });
    });

    it("is stale by time once the threshold is exceeded", () => {
        const now = Date.now();
        const result = computeEngineStaleness({
            lastScannedAt: now - ENGINE_STALENESS_THRESHOLD_MS - 1,
            maxReleaseDate: now - ENGINE_STALENESS_THRESHOLD_MS - 10_000,
            now,
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        expect(result).toEqual({ engineScanStale: true, engineScanStaleReason: "time" });
    });

    it("is stale by release when a newer Node.js release shipped after the last scan", () => {
        const now = Date.now();
        const result = computeEngineStaleness({
            lastScannedAt: now - 1000,
            maxReleaseDate: now,
            now,
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        expect(result).toEqual({ engineScanStale: true, engineScanStaleReason: "release" });
    });

    it("is stale for both reasons when both conditions hold", () => {
        const now = Date.now();
        const result = computeEngineStaleness({
            lastScannedAt: now - ENGINE_STALENESS_THRESHOLD_MS - 1,
            maxReleaseDate: now,
            now,
            thresholdMs: ENGINE_STALENESS_THRESHOLD_MS
        });

        expect(result).toEqual({ engineScanStale: true, engineScanStaleReason: "both" });
    });
});
