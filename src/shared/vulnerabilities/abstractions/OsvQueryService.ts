import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitySeverity } from "../types.js";

export interface IOsvQueryInput {
    name: string;
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

export interface IOsvQueryBatchInput {
    packages: IOsvQueryInput[];
}

export interface IOsvQueryService {
    queryBatch(input: IOsvQueryBatchInput): Promise<Map<string, IOsvAdvisory[]>>;
}

export const OsvQueryService = createAbstraction<IOsvQueryService>("Shared/OsvQueryService");

export namespace OsvQueryService {
    export type Interface = IOsvQueryService;
    export type Advisory = IOsvAdvisory;
    export type QueryInput = IOsvQueryInput;
    export type QueryBatchInput = IOsvQueryBatchInput;
}

/**
 * Maps a numeric CVSS base score (0-10) to our internal severity bucket.
 *
 * Exported as a standalone function rather than nested inside the
 * `OsvQueryService` namespace above: that namespace merges with the `const
 * OsvQueryService` abstraction value, and TypeScript only allows a
 * value-bearing namespace to merge with a `class`/`function`/`enum`
 * declaration of the same name — not a `const` — so a nested function
 * export here would fail to compile (TS2451: "Cannot redeclare block-scoped
 * variable"). This mirrors the existing convention in
 * `src/api/services/Vulnerability/abstractions/OsvCacheService.ts`.
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
