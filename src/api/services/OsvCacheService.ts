import { and, eq, gt, inArray, lt, type SQL } from "drizzle-orm";
import {
    OsvCacheService as Abstraction,
    mapCvssScoreToSeverity,
    osvCacheKey
} from "./abstractions/OsvCacheService.js";
import type {
    IOsvAdvisory,
    IOsvQueryInput,
    IOsvReference
} from "./abstractions/OsvCacheService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { osvCache } from "#api/db/schema.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const OSV_VULNERABILITY_URL = "https://api.osv.dev/v1/vulns";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
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

function getTtlMs(): number {
    const raw = process.env["OSV_CACHE_TTL_MS"];
    if (!raw) {
        return DEFAULT_TTL_MS;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

// ---------------------------------------------------------------------------
// OSV.dev response shapes.
//
// NOTE: `POST /v1/querybatch` only returns minimal `{ id, modified }` refs
// per vulnerability (verified against the live API) — it does NOT include
// summary/severity/affected data despite what a naive reading of the OSV
// docs might suggest. Full advisory details must be fetched per-id from
// `GET /v1/vulns/:id`.
// ---------------------------------------------------------------------------

interface IOsvBatchVulnerabilityRef {
    id: string;
}

interface IOsvBatchQueryResult {
    vulns?: IOsvBatchVulnerabilityRef[];
}

interface IOsvBatchResponse {
    results?: IOsvBatchQueryResult[];
}

interface IOsvSeverityEntry {
    type: string;
    score: string;
}

interface IOsvRangeEvent {
    introduced?: string;
    fixed?: string;
    last_affected?: string;
}

interface IOsvAffectedRange {
    events?: IOsvRangeEvent[];
}

interface IOsvAffectedPackage {
    name: string;
}

interface IOsvAffectedEntry {
    package?: IOsvAffectedPackage;
    ranges?: IOsvAffectedRange[];
}

interface IOsvVulnerabilityDetail {
    id: string;
    summary?: string;
    details?: string;
    severity?: IOsvSeverityEntry[];
    aliases?: string[];
    affected?: IOsvAffectedEntry[];
    references?: IOsvReference[];
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
function parseCvssV3Score(vector: string): number | null {
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
function parseCvssV2Score(vector: string): number | null {
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

    const score = v3 ? parseCvssV3Score(v3.score) : v2 ? parseCvssV2Score(v2.score) : null;
    return score === null ? "info" : mapCvssScoreToSeverity(score);
}

function buildVulnerableRange(ranges: IOsvAffectedRange[]): string | null {
    const segments: string[] = [];

    for (const range of ranges) {
        const parts: string[] = [];
        for (const event of range.events ?? []) {
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
        for (const event of range.events ?? []) {
            if (event.fixed !== undefined) {
                return event.fixed;
            }
        }
    }
    return null;
}

function toAdvisory(detail: IOsvVulnerabilityDetail, packageName: string): IOsvAdvisory {
    const matchingAffected = (detail.affected ?? []).filter(
        entry => entry.package?.name === packageName
    );
    const ranges = matchingAffected.flatMap(entry => entry.ranges ?? []);

    return {
        id: detail.id,
        summary: detail.summary ?? null,
        severity: resolveSeverity(detail.severity ?? []),
        aliases: detail.aliases ?? [],
        advisoryUrl: `https://osv.dev/vulnerability/${detail.id}`,
        vulnerableRange: buildVulnerableRange(ranges),
        fixVersion: extractFixVersion(ranges)
    };
}

class OsvCacheServiceImpl implements Abstraction.Interface {
    private readonly inFlight = new Map<string, Promise<IOsvAdvisory[]>>();

    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async queryBatch(packages: IOsvQueryInput[]): Promise<Map<string, IOsvAdvisory[]>> {
        const result = new Map<string, IOsvAdvisory[]>();
        if (packages.length === 0) {
            return result;
        }

        const ttlMs = getTtlMs();
        const now = Date.now();
        const uncached: IOsvQueryInput[] = [];
        const seenKeys = new Set<string>();

        const uniquePackages: IOsvQueryInput[] = [];
        for (const pkg of packages) {
            const key = osvCacheKey(pkg.packageName, pkg.version);
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniquePackages.push(pkg);
            }
        }

        const uniqueNames = [...new Set(uniquePackages.map(pkg => pkg.packageName))];
        const cachedRows =
            uniqueNames.length > 0
                ? await this.databaseClient.db
                      .select()
                      .from(osvCache)
                      .where(inArray(osvCache.packageName, uniqueNames))
                      .all()
                : [];

        const cacheIndex = new Map<string, (typeof cachedRows)[number]>();
        for (const row of cachedRows) {
            cacheIndex.set(osvCacheKey(row.packageName, row.version), row);
        }

        seenKeys.clear();
        for (const pkg of uniquePackages) {
            const key = osvCacheKey(pkg.packageName, pkg.version);
            const cached = cacheIndex.get(key);
            if (cached && now - cached.cachedAt < ttlMs) {
                result.set(key, JSON.parse(cached.data) as IOsvAdvisory[]);
            } else {
                seenKeys.add(key);
                uncached.push(pkg);
            }
        }

        if (uncached.length === 0) {
            return result;
        }

        // Split into packages whose fetch is already in flight (reuse the
        // existing promise) vs. packages that need a fresh, single combined
        // querybatch request — this is what makes the batch endpoint actually
        // batch instead of firing one HTTP call per package.
        const needsFetch: IOsvQueryInput[] = [];
        for (const pkg of uncached) {
            const key = osvCacheKey(pkg.packageName, pkg.version);
            if (!this.inFlight.has(key)) {
                needsFetch.push(pkg);
            }
        }

        if (needsFetch.length > 0) {
            const batchPromise = this.fetchAndStoreBatch(needsFetch);
            for (const pkg of needsFetch) {
                const key = osvCacheKey(pkg.packageName, pkg.version);
                const perPackagePromise = batchPromise.then(map => map.get(key) ?? []);
                this.inFlight.set(key, perPackagePromise);
                perPackagePromise.finally(() => {
                    this.inFlight.delete(key);
                });
            }
        }

        await Promise.all(
            uncached.map(async pkg => {
                const key = osvCacheKey(pkg.packageName, pkg.version);
                const advisories = await (this.inFlight.get(key) ?? Promise.resolve([]));
                result.set(key, advisories);
            })
        );

        return result;
    }

    /**
     * Fetches vulnerability data for multiple packages via a single combined
     * `POST /v1/querybatch` request, resolves the full advisory detail for
     * every unique vulnerability id referenced (deduped across all packages), and
     * persists a cache row per package.
     */
    private async fetchAndStoreBatch(pkgs: IOsvQueryInput[]): Promise<Map<string, IOsvAdvisory[]>> {
        const refsByIndex = await this.queryOsvBatch(pkgs);

        const uniqueIds = new Set<string>();
        for (const refs of refsByIndex) {
            for (const ref of refs) {
                uniqueIds.add(ref.id);
            }
        }
        const detailById = await this.fetchVulnerabilityDetails(Array.from(uniqueIds));

        const resultMap = new Map<string, IOsvAdvisory[]>();
        await Promise.all(
            pkgs.map(async (pkg, index) => {
                const refs = refsByIndex[index] ?? [];
                const advisories = refs
                    .map(ref => detailById.get(ref.id))
                    .filter((detail): detail is IOsvVulnerabilityDetail => detail !== undefined)
                    .map(detail => toAdvisory(detail, pkg.packageName));

                await this.storeInCache(pkg, advisories);
                resultMap.set(osvCacheKey(pkg.packageName, pkg.version), advisories);
            })
        );

        return resultMap;
    }

    private async storeInCache(pkg: IOsvQueryInput, advisories: IOsvAdvisory[]): Promise<void> {
        await this.databaseClient.db
            .insert(osvCache)
            .values({
                packageName: pkg.packageName,
                version: pkg.version,
                data: JSON.stringify(advisories),
                cachedAt: Date.now()
            })
            .onConflictDoUpdate({
                target: [osvCache.packageName, osvCache.version],
                set: { data: JSON.stringify(advisories), cachedAt: Date.now() }
            })
            .run();
    }

    /**
     * Single combined `POST /v1/querybatch` call for all given packages.
     * Returns per-package vulnerability refs, in the same order as `pkgs`.
     */
    private async queryOsvBatch(pkgs: IOsvQueryInput[]): Promise<IOsvBatchVulnerabilityRef[][]> {
        const response = await fetch(OSV_BATCH_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                queries: pkgs.map(pkg => ({
                    package: { name: pkg.packageName, ecosystem: "npm" },
                    version: pkg.version
                }))
            })
        });

        if (!response.ok) {
            throw new Error(
                `OSV batch query failed for ${pkgs.length} package(s): ` +
                    `${response.status} ${response.statusText}`
            );
        }

        const data = (await response.json()) as IOsvBatchResponse;
        return pkgs.map((_pkg, index) => data.results?.[index]?.vulns ?? []);
    }

    private async fetchVulnerabilityDetails(
        ids: string[]
    ): Promise<Map<string, IOsvVulnerabilityDetail>> {
        const detailById = new Map<string, IOsvVulnerabilityDetail>();
        if (ids.length === 0) {
            return detailById;
        }

        await mapWithConcurrency(ids, OSV_FETCH_CONCURRENCY, async id => {
            const response = await fetch(`${OSV_VULNERABILITY_URL}/${id}`);
            if (response.ok) {
                detailById.set(id, (await response.json()) as IOsvVulnerabilityDetail);
            }
        });

        return detailById;
    }

    public async getEnrichedDetail(osvId: string): Promise<Abstraction.EnrichedDetail | null> {
        try {
            const response = await fetch(`${OSV_VULNERABILITY_URL}/${osvId}`);
            if (!response.ok) {
                return null;
            }
            const detail = (await response.json()) as IOsvVulnerabilityDetail;

            let cvssScore: number | null = null;
            let cvssVector: string | null = null;
            for (const entry of detail.severity ?? []) {
                if (entry.type === "CVSS_V3") {
                    cvssVector = entry.score;
                    cvssScore = parseCvssV3Score(entry.score);
                    break;
                }
            }

            const affectedVersions: Abstraction.AffectedVersion[] = [];
            for (const affected of detail.affected ?? []) {
                for (const range of affected.ranges ?? []) {
                    let current: Abstraction.AffectedVersion | null = null;
                    for (const event of range.events ?? []) {
                        if (event.introduced !== undefined) {
                            if (current) {
                                affectedVersions.push(current);
                            }
                            current = {
                                introduced: event.introduced,
                                fixed: null,
                                lastAffected: null
                            };
                        } else if (current) {
                            if (event.fixed !== undefined) {
                                current.fixed = event.fixed;
                                affectedVersions.push(current);
                                current = null;
                            } else if (event.last_affected !== undefined) {
                                current.lastAffected = event.last_affected;
                                affectedVersions.push(current);
                                current = null;
                            }
                        }
                    }
                    if (current) {
                        affectedVersions.push(current);
                    }
                }
            }

            return {
                description: detail.details ?? detail.summary ?? null,
                references: (detail.references ?? []).map(ref => ({
                    type: ref.type,
                    url: ref.url
                })),
                affectedVersions,
                cvssScore,
                cvssVector,
                aliases: detail.aliases ?? []
            };
        } catch {
            return null;
        }
    }

    public async invalidate(options: Abstraction.InvalidateOptions = {}): Promise<number> {
        const hasFilter =
            options.packageName !== undefined ||
            (options.packageNames !== undefined && options.packageNames.length > 0) ||
            options.olderThanMs !== undefined ||
            options.newerThanMs !== undefined;

        // Guard against wiping the entire cache by accident — e.g. an API
        // route that forwards an all-optional request body as-is. Clearing
        // everything requires an explicit `all: true`.
        if (!hasFilter && options.all !== true) {
            return 0;
        }

        const whereClause = options.all ? undefined : this.buildInvalidateWhere(options);

        const rows = whereClause
            ? await this.databaseClient.db.select().from(osvCache).where(whereClause).all()
            : await this.databaseClient.db.select().from(osvCache).all();

        if (whereClause) {
            await this.databaseClient.db.delete(osvCache).where(whereClause).run();
        } else {
            await this.databaseClient.db.delete(osvCache).run();
        }

        return rows.length;
    }

    private buildInvalidateWhere(options: Abstraction.InvalidateOptions): SQL | undefined {
        const conditions: SQL[] = [];

        if (options.packageName !== undefined) {
            conditions.push(eq(osvCache.packageName, options.packageName));
        }
        if (options.packageNames !== undefined && options.packageNames.length > 0) {
            conditions.push(inArray(osvCache.packageName, options.packageNames));
        }
        if (options.olderThanMs !== undefined) {
            conditions.push(lt(osvCache.cachedAt, Date.now() - options.olderThanMs));
        }
        if (options.newerThanMs !== undefined) {
            conditions.push(gt(osvCache.cachedAt, Date.now() - options.newerThanMs));
        }

        if (conditions.length === 0) {
            return undefined;
        }
        return and(...conditions);
    }
}

export const OsvCacheService = Abstraction.createImplementation({
    implementation: OsvCacheServiceImpl,
    dependencies: [DatabaseClient]
});
