import { z } from "zod";
import {
    OsvQueryService as Abstraction,
    mapCvssScoreToSeverity
} from "./abstractions/OsvQueryService.js";
import type {
    IOsvAdvisory,
    IOsvQueryBatchInput,
    IOsvQueryInput
} from "./abstractions/OsvQueryService.js";
import type { VulnerabilitySeverity } from "./types.js";

export const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
export const OSV_VULNERABILITY_URL = "https://api.osv.dev/v1/vulns";
const OSV_FETCH_CONCURRENCY = 5;

async function mapWithConcurrency<TInput, TOutput>(
    items: TInput[],
    concurrency: number,
    fn: (item: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
    const results: TOutput[] = new Array(items.length);
    let nextIndex = 0;

    async function worker(): Promise<void> {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await fn(items[index]!);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}

// ---------------------------------------------------------------------------
// OSV.dev response shapes.
//
// `POST /v1/querybatch` normally returns minimal `{ id, modified }` refs per
// vulnerability (verified against the live API) — no summary/severity/
// affected data. Full advisory details must be fetched per-id from
// `GET /v1/vulns/:id`. The batch-ref schema below therefore leaves the rich
// fields (`summary`/`severity`/`aliases`/`affected`) undefined rather than
// defaulted, so `hasInlineDetail()` can tell a bare ref apart from a fully
// self-describing entry and skip the redundant per-id fetch when the batch
// response already carries everything needed.
// ---------------------------------------------------------------------------

const osvSeverityEntrySchema = z.object({ type: z.string(), score: z.string() });

const osvAffectedEventSchema = z.object({
    introduced: z.string().optional(),
    fixed: z.string().optional(),
    last_affected: z.string().optional()
});

const osvAffectedRangeSchema = z.object({
    events: z.array(osvAffectedEventSchema).optional().default([])
});

const osvAffectedEntrySchema = z.object({
    package: z.object({ name: z.string() }).optional(),
    ranges: z.array(osvAffectedRangeSchema).optional().default([])
});

const osvReferenceSchema = z.object({
    type: z.string().optional().default("WEB"),
    url: z.string()
});

export const osvVulnerabilityDetailSchema = z.object({
    id: z.string(),
    summary: z.string().optional(),
    details: z.string().optional(),
    severity: z.array(osvSeverityEntrySchema).optional().default([]),
    aliases: z.array(z.string()).optional().default([]),
    affected: z.array(osvAffectedEntrySchema).optional().default([]),
    references: z.array(osvReferenceSchema).optional().default([])
});

export type IOsvVulnerabilityDetail = z.infer<typeof osvVulnerabilityDetailSchema>;
type IOsvSeverityEntry = z.infer<typeof osvSeverityEntrySchema>;
type IOsvAffectedEntry = z.infer<typeof osvAffectedEntrySchema>;
type IOsvAffectedRange = IOsvAffectedEntry["ranges"][number];

const osvBatchVulnRefSchema = z.object({
    id: z.string(),
    summary: z.string().optional(),
    severity: z.array(osvSeverityEntrySchema).optional(),
    aliases: z.array(z.string()).optional(),
    affected: z.array(osvAffectedEntrySchema).optional()
});

type IOsvBatchVulnRef = z.infer<typeof osvBatchVulnRefSchema>;

const osvBatchResponseSchema = z.object({
    results: z
        .array(
            z.object({
                vulns: z.array(osvBatchVulnRefSchema).optional().default([])
            })
        )
        .optional()
        .default([])
});

function hasInlineDetail(ref: IOsvBatchVulnRef): boolean {
    return (
        ref.summary !== undefined ||
        ref.severity !== undefined ||
        ref.aliases !== undefined ||
        ref.affected !== undefined
    );
}

function toDetailFromInlineRef(ref: IOsvBatchVulnRef): IOsvVulnerabilityDetail {
    return {
        id: ref.id,
        summary: ref.summary,
        details: undefined,
        severity: ref.severity ?? [],
        aliases: ref.aliases ?? [],
        affected: ref.affected ?? [],
        references: []
    };
}

// ---------------------------------------------------------------------------
// CVSS vector parsing.
//
// OSV's `severity[].score` field is NOT a bare number — for CVSS_V3/CVSS_V2
// entries it's the full vector string (e.g. "CVSS:3.1/AV:N/AC:L/..."; verified
// against the live API). We compute the base score from the vector ourselves
// so the >=9.0/7.0/4.0/0.1 thresholds have a number to compare against.
// ---------------------------------------------------------------------------

function parseCvssVectorMetrics(vector: string): Record<string, string> {
    const metrics: Record<string, string> = {};
    for (const part of vector.split("/")) {
        const [key, value] = part.split(":");
        if (key && value) {
            metrics[key] = value;
        }
    }
    return metrics;
}

function cvssV3RoundUp(value: number): number {
    const scaled = Math.round(value * 100000);
    if (scaled % 10000 === 0) {
        return scaled / 100000;
    }
    return (Math.floor(scaled / 10000) + 1) / 10;
}

const CVSS_V3_AV: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const CVSS_V3_AC: Record<string, number> = { L: 0.77, H: 0.44 };
const CVSS_V3_UI: Record<string, number> = { N: 0.85, R: 0.62 };
const CVSS_V3_CIA: Record<string, number> = { N: 0, L: 0.22, H: 0.56 };
const CVSS_V3_PR_UNCHANGED: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
const CVSS_V3_PR_CHANGED: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 };

/** Base score (0-10) from a CVSS v3.0/v3.1 vector string, or null if unparseable. */
export function parseCvssV3Vector(vector: string): number | null {
    const metrics = parseCvssVectorMetrics(vector);
    const scopeChanged = metrics["S"] === "C";
    const prTable = scopeChanged ? CVSS_V3_PR_CHANGED : CVSS_V3_PR_UNCHANGED;

    const av = CVSS_V3_AV[metrics["AV"] ?? ""];
    const ac = CVSS_V3_AC[metrics["AC"] ?? ""];
    const pr = prTable[metrics["PR"] ?? ""];
    const ui = CVSS_V3_UI[metrics["UI"] ?? ""];
    const c = CVSS_V3_CIA[metrics["C"] ?? ""];
    const i = CVSS_V3_CIA[metrics["I"] ?? ""];
    const a = CVSS_V3_CIA[metrics["A"] ?? ""];

    if (
        av === undefined ||
        ac === undefined ||
        pr === undefined ||
        ui === undefined ||
        c === undefined ||
        i === undefined ||
        a === undefined
    ) {
        return null;
    }

    const iss = 1 - (1 - c) * (1 - i) * (1 - a);
    const impact = scopeChanged
        ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
        : 6.42 * iss;

    if (impact <= 0) {
        return 0;
    }

    const exploitability = 8.22 * av * ac * pr * ui;
    const raw = scopeChanged ? 1.08 * (impact + exploitability) : impact + exploitability;
    return cvssV3RoundUp(Math.min(raw, 10));
}

const CVSS_V2_AV: Record<string, number> = { L: 0.395, A: 0.646, N: 1.0 };
const CVSS_V2_AC: Record<string, number> = { H: 0.35, M: 0.61, L: 0.71 };
const CVSS_V2_AU: Record<string, number> = { M: 0.45, S: 0.56, N: 0.704 };
const CVSS_V2_CIA: Record<string, number> = { N: 0, P: 0.275, C: 0.66 };

/** Base score (0-10) from a CVSS v2 vector string, or null if unparseable. */
export function parseCvssV2Vector(vector: string): number | null {
    const metrics = parseCvssVectorMetrics(vector);

    const av = CVSS_V2_AV[metrics["AV"] ?? ""];
    const ac = CVSS_V2_AC[metrics["AC"] ?? ""];
    const au = CVSS_V2_AU[metrics["Au"] ?? ""];
    const c = CVSS_V2_CIA[metrics["C"] ?? ""];
    const i = CVSS_V2_CIA[metrics["I"] ?? ""];
    const a = CVSS_V2_CIA[metrics["A"] ?? ""];

    if (
        av === undefined ||
        ac === undefined ||
        au === undefined ||
        c === undefined ||
        i === undefined ||
        a === undefined
    ) {
        return null;
    }

    const impact = 10.41 * (1 - (1 - c) * (1 - i) * (1 - a));
    const exploitability = 20 * av * ac * au;
    const fImpact = impact === 0 ? 0 : 1.176;
    const base = (0.6 * impact + 0.4 * exploitability - 1.5) * fImpact;
    return Math.round(base * 10) / 10;
}

function resolveSeverity(entries: IOsvSeverityEntry[]): VulnerabilitySeverity {
    const v3 = entries.find(entry => entry.type === "CVSS_V3");
    const v2 = entries.find(entry => entry.type === "CVSS_V2");

    const score = v3 ? parseCvssV3Vector(v3.score) : v2 ? parseCvssV2Vector(v2.score) : null;
    return score === null ? "info" : mapCvssScoreToSeverity(score);
}

function buildVulnerableRange(ranges: IOsvAffectedRange[]): string | null {
    const segments: string[] = [];

    for (const range of ranges) {
        const parts: string[] = [];
        for (const event of range.events) {
            if (event.introduced !== undefined && event.introduced !== "0") {
                parts.push(`>=${event.introduced}`);
            }
            if (event.fixed !== undefined) {
                parts.push(`<${event.fixed}`);
            }
            if (event.last_affected !== undefined) {
                parts.push(`<=${event.last_affected}`);
            }
        }
        if (parts.length > 0) {
            segments.push(parts.join(" "));
        }
    }

    return segments.length > 0 ? segments.join(" || ") : null;
}

function extractFixVersion(ranges: IOsvAffectedRange[]): string | null {
    for (const range of ranges) {
        for (const event of range.events) {
            if (event.fixed !== undefined) {
                return event.fixed;
            }
        }
    }
    return null;
}

interface IToAdvisoryInput {
    detail: IOsvVulnerabilityDetail;
    packageName: string;
}

function toAdvisory(input: IToAdvisoryInput): IOsvAdvisory {
    const matchingAffected = input.detail.affected.filter(
        entry => entry.package?.name === input.packageName
    );
    const ranges = matchingAffected.flatMap(entry => entry.ranges);

    return {
        id: input.detail.id,
        summary: input.detail.summary ?? null,
        severity: resolveSeverity(input.detail.severity),
        aliases: input.detail.aliases,
        advisoryUrl: `https://osv.dev/vulnerability/${input.detail.id}`,
        vulnerableRange: buildVulnerableRange(ranges),
        fixVersion: extractFixVersion(ranges)
    };
}

function buildQueryKey(pkg: IOsvQueryInput): string {
    return `${pkg.name}@${pkg.version}`;
}

class OsvQueryServiceImpl implements Abstraction.Interface {
    public async queryBatch(input: IOsvQueryBatchInput): Promise<Map<string, IOsvAdvisory[]>> {
        const result = new Map<string, IOsvAdvisory[]>();
        if (input.packages.length === 0) {
            return result;
        }

        try {
            const refsByIndex = await this.queryOsvBatch(input.packages);
            const detailById = await this.resolveVulnerabilityDetails(refsByIndex);

            input.packages.forEach((pkg, index) => {
                const refs = refsByIndex[index] ?? [];
                const advisories = refs
                    .map(ref => detailById.get(ref.id))
                    .filter((detail): detail is IOsvVulnerabilityDetail => detail !== undefined)
                    .map(detail => toAdvisory({ detail, packageName: pkg.name }));

                result.set(buildQueryKey(pkg), advisories);
            });
        } catch (error) {
            console.warn(
                `OSV batch query failed for ${input.packages.length} package(s): ` +
                    `${error instanceof Error ? error.message : String(error)}`
            );
        }

        return result;
    }

    /**
     * Single combined `POST /v1/querybatch` call for all given packages.
     * Returns per-package vulnerability refs, in the same order as `packages`.
     */
    private async queryOsvBatch(packages: IOsvQueryInput[]): Promise<IOsvBatchVulnRef[][]> {
        const response = await fetch(OSV_BATCH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                queries: packages.map(pkg => ({
                    package: { name: pkg.name, ecosystem: "npm" },
                    version: pkg.version
                }))
            })
        });

        if (!response.ok) {
            throw new Error(
                `OSV batch query failed for ${packages.length} package(s): ` +
                    `${response.status} ${response.statusText}`
            );
        }

        const data = osvBatchResponseSchema.parse(await response.json());
        return packages.map((_pkg, index) => data.results[index]?.vulns ?? []);
    }

    /**
     * Resolves a full `IOsvVulnerabilityDetail` for every unique vulnerability
     * id referenced across all batch refs. Refs that already carry rich data
     * inline (see `hasInlineDetail`) are used as-is; the remaining ids are
     * fetched concurrently from `GET /v1/vulns/:id`.
     */
    private async resolveVulnerabilityDetails(
        refsByIndex: IOsvBatchVulnRef[][]
    ): Promise<Map<string, IOsvVulnerabilityDetail>> {
        const detailById = new Map<string, IOsvVulnerabilityDetail>();
        const idsNeedingFetch = new Set<string>();

        for (const refs of refsByIndex) {
            for (const ref of refs) {
                if (hasInlineDetail(ref)) {
                    detailById.set(ref.id, toDetailFromInlineRef(ref));
                } else if (!detailById.has(ref.id)) {
                    idsNeedingFetch.add(ref.id);
                }
            }
        }
        for (const id of detailById.keys()) {
            idsNeedingFetch.delete(id);
        }

        if (idsNeedingFetch.size > 0) {
            await mapWithConcurrency(
                Array.from(idsNeedingFetch),
                OSV_FETCH_CONCURRENCY,
                async id => {
                    const response = await fetch(`${OSV_VULNERABILITY_URL}/${id}`);
                    if (response.ok) {
                        detailById.set(
                            id,
                            osvVulnerabilityDetailSchema.parse(await response.json())
                        );
                    }
                }
            );
        }

        return detailById;
    }
}

export const OsvQueryService = Abstraction.createImplementation({
    implementation: OsvQueryServiceImpl,
    dependencies: []
});
