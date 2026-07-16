import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";

export interface IOsvQueryInput {
    packageName: string;
    version: string;
}

export interface IOsvAdvisory {
    id: string;
    summary: string | null;
    severity: VulnerabilitySeverity;
    aliases: string[];
    advisoryUrl: string;
    vulnerableRange: string | null;
    fixVersion: string | null;
}

export interface IOsvReference {
    type: string;
    url: string;
}

export interface IOsvAffectedVersion {
    introduced: string | null;
    fixed: string | null;
    lastAffected: string | null;
}

export interface IOsvEnrichedDetail {
    description: string | null;
    references: IOsvReference[];
    affectedVersions: IOsvAffectedVersion[];
    cvssScore: number | null;
    cvssVector: string | null;
    aliases: string[];
}

export interface IOsvInvalidateOptions {
    packageName?: string;
    packageNames?: string[];
    all?: boolean;
    olderThanMs?: number;
    newerThanMs?: number;
}

export interface IOsvCacheService {
    queryBatch(packages: IOsvQueryInput[]): Promise<Map<string, IOsvAdvisory[]>>;
    invalidate(options?: IOsvInvalidateOptions): Promise<number>;
    getEnrichedDetail(osvId: string): Promise<IOsvEnrichedDetail | null>;
}

/**
 * Key format used both for `IOsvCacheService.queryBatch`'s result map and for
 * in-flight request de-duplication. Exported so callers of `queryBatch` don't
 * have to guess the key shape when reading results back out of the map.
 */
export function osvCacheKey(packageName: string, version: string): string {
    return `${packageName}@${version}`;
}

export const OsvCacheService = createAbstraction<IOsvCacheService>("Api/OsvCacheService");

export namespace OsvCacheService {
    export type Interface = IOsvCacheService;
    export type QueryInput = IOsvQueryInput;
    export type Advisory = IOsvAdvisory;
    export type InvalidateOptions = IOsvInvalidateOptions;
    export type EnrichedDetail = IOsvEnrichedDetail;
    export type Reference = IOsvReference;
    export type AffectedVersion = IOsvAffectedVersion;
}

/**
 * Maps a numeric CVSS base score (0-10) to our internal severity bucket.
 */
export function mapCvssScoreToSeverity(score: number): VulnerabilitySeverity {
    if (score >= 9.0) {
        return "critical";
    }
    if (score >= 7.0) {
        return "high";
    }
    if (score >= 4.0) {
        return "moderate";
    }
    if (score >= 0.1) {
        return "low";
    }
    return "info";
}
