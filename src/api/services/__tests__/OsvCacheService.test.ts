import { describe, it, expect, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { osvCache } from "#api/db/schema.js";
import {
    OsvCacheService,
    mapCvssScoreToSeverity,
    osvCacheKey
} from "../abstractions/OsvCacheService.js";
import { OsvCacheService as OsvCacheServiceRegistration } from "../OsvCacheService.js";

const OSV_BATCH_URL = "https://api.osv.dev/v1/querybatch";
const OSV_VULNERABILITY_URL = "https://api.osv.dev/v1/vulns";

interface IMockVulnerabilityRef {
    id: string;
}

interface IMockVulnerabilityDetail {
    id: string;
    summary?: string;
    severity?: { type: string; score: string }[];
    aliases?: string[];
    affected?: {
        package: { name: string };
        ranges: { events: { introduced?: string; fixed?: string }[] }[];
    }[];
}

function jsonResponse(body: unknown, ok = true): Response {
    return new Response(JSON.stringify(body), { status: ok ? 200 : 500 });
}

/**
 * Builds a fetch mock that serves a fixed batch-query result and a lookup
 * table of full vulnerability details keyed by id, mirroring the real OSV.dev API
 * shape: `POST /v1/querybatch` returns minimal `{id}` refs, `GET /v1/vulns/:id`
 * returns the full advisory.
 */
function createMockFetch(
    batchRefs: IMockVulnerabilityRef[],
    detailsById: Record<string, IMockVulnerabilityDetail>
): ReturnType<typeof vi.fn> {
    return vi.fn(async (url: string) => {
        if (url === OSV_BATCH_URL) {
            return jsonResponse({ results: [{ vulns: batchRefs }] });
        }
        if (url.startsWith(`${OSV_VULNERABILITY_URL}/`)) {
            const id = url.slice(`${OSV_VULNERABILITY_URL}/`.length);
            const detail = detailsById[id];
            return detail ? jsonResponse(detail) : jsonResponse({}, false);
        }
        throw new Error(`Unexpected fetch call: ${url}`);
    });
}

async function createService(): Promise<{
    service: OsvCacheService.Interface;
    db: Awaited<ReturnType<typeof createTestDb>>;
}> {
    const db = await createTestDb();
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.register(OsvCacheServiceRegistration).inSingletonScope();
    const service = container.resolve(OsvCacheService);
    return { service, db };
}

describe("mapCvssScoreToSeverity", () => {
    it("maps scores to the correct severity bucket at and around boundaries", () => {
        expect(mapCvssScoreToSeverity(10)).toBe("critical");
        expect(mapCvssScoreToSeverity(9.0)).toBe("critical");
        expect(mapCvssScoreToSeverity(8.9)).toBe("high");
        expect(mapCvssScoreToSeverity(7.0)).toBe("high");
        expect(mapCvssScoreToSeverity(6.9)).toBe("moderate");
        expect(mapCvssScoreToSeverity(4.0)).toBe("moderate");
        expect(mapCvssScoreToSeverity(3.9)).toBe("low");
        expect(mapCvssScoreToSeverity(0.1)).toBe("low");
        expect(mapCvssScoreToSeverity(0.09)).toBe("info");
        expect(mapCvssScoreToSeverity(0)).toBe("info");
    });
});

describe("OsvCacheService", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        delete process.env["OSV_CACHE_TTL_MS"];
    });

    describe("queryBatch", () => {
        it("returns an empty map for a batch of 0 packages without calling fetch", async () => {
            const { service } = await createService();
            const fetchSpy = vi.fn();
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.queryBatch([]);

            expect(result.size).toBe(0);
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        it("on cache miss: queries OSV, stores in DB, and returns the advisory", async () => {
            const { service, db } = await createService();
            vi.stubGlobal(
                "fetch",
                createMockFetch([{ id: "GHSA-test-1234" }], {
                    "GHSA-test-1234": {
                        id: "GHSA-test-1234",
                        summary: "Prototype Pollution in left-pad",
                        severity: [
                            {
                                type: "CVSS_V3",
                                score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H"
                            }
                        ],
                        aliases: ["CVE-2020-0001"],
                        affected: [
                            {
                                package: { name: "left-pad" },
                                ranges: [{ events: [{ introduced: "0" }, { fixed: "1.3.0" }] }]
                            }
                        ]
                    }
                })
            );

            const result = await service.queryBatch([
                { packageName: "left-pad", version: "1.2.0" }
            ]);

            const advisories = result.get(osvCacheKey("left-pad", "1.2.0"));
            expect(advisories).toHaveLength(1);
            expect(advisories?.[0]).toMatchObject({
                id: "GHSA-test-1234",
                summary: "Prototype Pollution in left-pad",
                severity: "critical",
                aliases: ["CVE-2020-0001"],
                advisoryUrl: "https://osv.dev/vulnerability/GHSA-test-1234",
                vulnerableRange: "<1.3.0",
                fixVersion: "1.3.0"
            });

            const cached = await db
                .select()
                .from(osvCache)
                .where(eq(osvCache.packageName, "left-pad"))
                .get();
            expect(cached).toBeDefined();
            expect(cached!.version).toBe("1.2.0");
            expect(JSON.parse(cached!.data)).toHaveLength(1);
        });

        it("on cache hit: returns from DB without calling fetch", async () => {
            const { service, db } = await createService();
            await db.insert(osvCache).values({
                packageName: "left-pad",
                version: "1.2.0",
                data: JSON.stringify([
                    {
                        id: "GHSA-cached",
                        summary: "cached advisory",
                        severity: "low",
                        aliases: [],
                        advisoryUrl: "https://osv.dev/vulnerability/GHSA-cached",
                        vulnerableRange: null,
                        fixVersion: null
                    }
                ]),
                cachedAt: Date.now()
            });
            const fetchSpy = vi.fn();
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.queryBatch([
                { packageName: "left-pad", version: "1.2.0" }
            ]);

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(result.get(osvCacheKey("left-pad", "1.2.0"))).toEqual([
                expect.objectContaining({ id: "GHSA-cached" })
            ]);
        });

        it("re-queries OSV when the cached entry is stale (past TTL)", async () => {
            process.env["OSV_CACHE_TTL_MS"] = "1000";
            const { service, db } = await createService();
            await db.insert(osvCache).values({
                packageName: "left-pad",
                version: "1.2.0",
                data: JSON.stringify([{ id: "GHSA-stale" }]),
                cachedAt: Date.now() - 5000
            });
            const fetchSpy = createMockFetch([], {});
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.queryBatch([
                { packageName: "left-pad", version: "1.2.0" }
            ]);

            expect(fetchSpy).toHaveBeenCalled();
            expect(result.get(osvCacheKey("left-pad", "1.2.0"))).toEqual([]);
        });

        it("returns an empty array when OSV has no vulnerabilities for the package", async () => {
            const { service } = await createService();
            vi.stubGlobal("fetch", createMockFetch([], {}));

            const result = await service.queryBatch([
                { packageName: "safe-pkg", version: "1.0.0" }
            ]);

            expect(result.get(osvCacheKey("safe-pkg", "1.0.0"))).toEqual([]);
        });

        it("de-duplicates in-flight requests when the same package@version appears twice in one batch", async () => {
            // Array.prototype.map invokes each callback synchronously in order, so
            // the second occurrence's synchronous `inFlight.get(key)` check runs
            // after the first occurrence's synchronous `inFlight.set(key, ...)` —
            // this deterministically exercises the dedup map without depending on
            // any DB/fetch timing race.
            const { service } = await createService();
            const fetchSpy = createMockFetch([{ id: "GHSA-dedup" }], {
                "GHSA-dedup": { id: "GHSA-dedup", summary: "dedup test" }
            });
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.queryBatch([
                { packageName: "dedup-pkg", version: "1.0.0" },
                { packageName: "dedup-pkg", version: "1.0.0" }
            ]);

            expect(result.get(osvCacheKey("dedup-pkg", "1.0.0"))).toEqual([
                expect.objectContaining({ id: "GHSA-dedup" })
            ]);
            // 1 call to querybatch + 1 call to fetch the single vulnerability detail —
            // proves the second occurrence reused the first's in-flight promise.
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it("retrieves multiple cached entries in a single batched DB query", async () => {
            const { service, db } = await createService();
            const now = Date.now();
            await db.insert(osvCache).values([
                {
                    packageName: "batch-a",
                    version: "1.0.0",
                    data: JSON.stringify([{ id: "A1", summary: "a1" }]),
                    cachedAt: now
                },
                {
                    packageName: "batch-b",
                    version: "2.0.0",
                    data: JSON.stringify([{ id: "B1", summary: "b1" }]),
                    cachedAt: now
                },
                {
                    packageName: "batch-c",
                    version: "3.0.0",
                    data: JSON.stringify([]),
                    cachedAt: now
                }
            ]);
            const fetchSpy = vi.fn();
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.queryBatch([
                { packageName: "batch-a", version: "1.0.0" },
                { packageName: "batch-b", version: "2.0.0" },
                { packageName: "batch-c", version: "3.0.0" }
            ]);

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(result.get(osvCacheKey("batch-a", "1.0.0"))).toEqual([
                expect.objectContaining({ id: "A1" })
            ]);
            expect(result.get(osvCacheKey("batch-b", "2.0.0"))).toEqual([
                expect.objectContaining({ id: "B1" })
            ]);
            expect(result.get(osvCacheKey("batch-c", "3.0.0"))).toEqual([]);
        });

        it("handles mix of cached and uncached packages correctly", async () => {
            const { service, db } = await createService();
            await db.insert(osvCache).values({
                packageName: "cached-pkg",
                version: "1.0.0",
                data: JSON.stringify([{ id: "CACHED-1", summary: "cached" }]),
                cachedAt: Date.now()
            });
            vi.stubGlobal("fetch", createMockFetch([], {}));

            const result = await service.queryBatch([
                { packageName: "cached-pkg", version: "1.0.0" },
                { packageName: "uncached-pkg", version: "2.0.0" }
            ]);

            expect(result.get(osvCacheKey("cached-pkg", "1.0.0"))).toEqual([
                expect.objectContaining({ id: "CACHED-1" })
            ]);
            expect(result.get(osvCacheKey("uncached-pkg", "2.0.0"))).toEqual([]);
        });

        it("limits concurrent vulnerability-detail fetches to avoid overwhelming the API", async () => {
            const { service } = await createService();
            let peakConcurrency = 0;
            let activeFetches = 0;

            const vulnerabilityIds = Array.from({ length: 12 }, (_, i) => `GHSA-conc-${i}`);
            const batchRefs = vulnerabilityIds.map(id => ({ id }));
            const detailsById: Record<string, IMockVulnerabilityDetail> = {};
            for (const id of vulnerabilityIds) {
                detailsById[id] = { id, summary: `vulnerability ${id}` };
            }

            vi.stubGlobal(
                "fetch",
                vi.fn(async (url: string) => {
                    if (url === OSV_BATCH_URL) {
                        return jsonResponse({ results: [{ vulns: batchRefs }] });
                    }
                    if (url.startsWith(`${OSV_VULNERABILITY_URL}/`)) {
                        activeFetches++;
                        peakConcurrency = Math.max(peakConcurrency, activeFetches);
                        await new Promise(resolve => setTimeout(resolve, 10));
                        activeFetches--;
                        const id = url.slice(`${OSV_VULNERABILITY_URL}/`.length);
                        return detailsById[id]
                            ? jsonResponse(detailsById[id])
                            : jsonResponse({}, false);
                    }
                    throw new Error(`Unexpected fetch: ${url}`);
                })
            );

            const result = await service.queryBatch([
                { packageName: "conc-pkg", version: "1.0.0" }
            ]);

            const advisories = result.get(osvCacheKey("conc-pkg", "1.0.0"));
            expect(advisories).toHaveLength(12);
            expect(peakConcurrency).toBeLessThanOrEqual(5);
            expect(peakConcurrency).toBeGreaterThan(1);
        });

        it("combines multiple distinct uncached packages into a single querybatch request", async () => {
            const { service } = await createService();
            const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
                if (url !== OSV_BATCH_URL) {
                    throw new Error(`Unexpected fetch call: ${url}`);
                }
                const body = JSON.parse(init?.body as string) as { queries: unknown[] };
                // No vulnerabilities for any package, so no follow-up detail fetches are
                // triggered — isolates the assertion to the batch call itself.
                return jsonResponse({ results: body.queries.map(() => ({ vulns: [] })) });
            });
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.queryBatch([
                { packageName: "pkg-a", version: "1.0.0" },
                { packageName: "pkg-b", version: "2.0.0" },
                { packageName: "pkg-c", version: "3.0.0" }
            ]);

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(init.body as string) as { queries: unknown[] };
            expect(body.queries).toHaveLength(3);

            expect(result.get(osvCacheKey("pkg-a", "1.0.0"))).toEqual([]);
            expect(result.get(osvCacheKey("pkg-b", "2.0.0"))).toEqual([]);
            expect(result.get(osvCacheKey("pkg-c", "3.0.0"))).toEqual([]);
        });
    });

    describe("getEnrichedDetail", () => {
        it("returns full description, references, affected versions, CVSS info, and aliases", async () => {
            const { service } = await createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async (url: string) => {
                    expect(url).toBe(`${OSV_VULNERABILITY_URL}/GHSA-test-1234`);
                    return jsonResponse({
                        id: "GHSA-test-1234",
                        summary: "short summary",
                        details: "full markdown details",
                        severity: [
                            {
                                type: "CVSS_V3",
                                score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H"
                            }
                        ],
                        aliases: ["CVE-2020-0001"],
                        affected: [
                            {
                                package: { name: "left-pad" },
                                ranges: [
                                    {
                                        events: [{ introduced: "0" }, { fixed: "1.3.0" }]
                                    }
                                ]
                            }
                        ],
                        references: [{ type: "ADVISORY", url: "https://example.com/adv" }]
                    });
                })
            );

            const result = await service.getEnrichedDetail("GHSA-test-1234");

            expect(result).toEqual({
                description: "full markdown details",
                references: [{ type: "ADVISORY", url: "https://example.com/adv" }],
                affectedVersions: [{ introduced: "0", fixed: "1.3.0", lastAffected: null }],
                cvssScore: expect.any(Number),
                cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H",
                aliases: ["CVE-2020-0001"]
            });
        });

        it("falls back to summary when details is missing", async () => {
            const { service } = await createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () =>
                    jsonResponse({ id: "GHSA-summary-only", summary: "just a summary" })
                )
            );

            const result = await service.getEnrichedDetail("GHSA-summary-only");

            expect(result?.description).toBe("just a summary");
            expect(result?.references).toEqual([]);
            expect(result?.affectedVersions).toEqual([]);
            expect(result?.cvssScore).toBeNull();
            expect(result?.cvssVector).toBeNull();
            expect(result?.aliases).toEqual([]);
        });

        it("returns null when OSV responds with a non-OK status", async () => {
            const { service } = await createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => jsonResponse({}, false))
            );

            const result = await service.getEnrichedDetail("does-not-exist");

            expect(result).toBeNull();
        });

        it("returns null when fetch throws", async () => {
            const { service } = await createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => {
                    throw new Error("network error");
                })
            );

            const result = await service.getEnrichedDetail("GHSA-boom");

            expect(result).toBeNull();
        });
    });

    describe("invalidate", () => {
        async function seedThreeEntries(db: Awaited<ReturnType<typeof createTestDb>>) {
            await db.insert(osvCache).values([
                {
                    packageName: "pkg-a",
                    version: "1.0.0",
                    data: "[]",
                    cachedAt: Date.now() - 100_000
                },
                {
                    packageName: "pkg-a",
                    version: "2.0.0",
                    data: "[]",
                    cachedAt: Date.now()
                },
                {
                    packageName: "pkg-b",
                    version: "1.0.0",
                    data: "[]",
                    cachedAt: Date.now()
                }
            ]);
        }

        it("invalidates by packageName only", async () => {
            const { service, db } = await createService();
            await seedThreeEntries(db);

            const count = await service.invalidate({ packageName: "pkg-a" });

            expect(count).toBe(2);
            const remaining = await db.select().from(osvCache).all();
            expect(remaining).toHaveLength(1);
            expect(remaining[0]?.packageName).toBe("pkg-b");
        });

        it("is a no-op and returns 0 when called with no options (guards against accidental full wipe)", async () => {
            const { service, db } = await createService();
            await seedThreeEntries(db);

            const count = await service.invalidate();

            expect(count).toBe(0);
            expect(await db.select().from(osvCache).all()).toHaveLength(3);
        });

        it("is a no-op and returns 0 when called with an empty options object", async () => {
            const { service, db } = await createService();
            await seedThreeEntries(db);

            const count = await service.invalidate({});

            expect(count).toBe(0);
            expect(await db.select().from(osvCache).all()).toHaveLength(3);
        });

        it("invalidates everything when `all: true` is passed, ignoring other filters", async () => {
            const { service, db } = await createService();
            await seedThreeEntries(db);

            const count = await service.invalidate({ all: true, packageName: "pkg-a" });

            expect(count).toBe(3);
            expect(await db.select().from(osvCache).all()).toHaveLength(0);
        });

        it("invalidates entries older than olderThanMs", async () => {
            const { service, db } = await createService();
            await seedThreeEntries(db);

            const count = await service.invalidate({ olderThanMs: 50_000 });

            expect(count).toBe(1);
            const remaining = await db.select().from(osvCache).all();
            expect(remaining.map(row => `${row.packageName}@${row.version}`)).not.toContain(
                "pkg-a@1.0.0"
            );
        });

        it("invalidates entries newer than newerThanMs", async () => {
            const { service, db } = await createService();
            await seedThreeEntries(db);

            const count = await service.invalidate({ newerThanMs: 50_000 });

            expect(count).toBe(2);
            const remaining = await db.select().from(osvCache).all();
            expect(remaining).toHaveLength(1);
            expect(remaining[0]?.version).toBe("1.0.0");
            expect(remaining[0]?.packageName).toBe("pkg-a");
        });
    });
});
