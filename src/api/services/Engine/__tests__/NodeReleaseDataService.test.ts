import { describe, it, expect, afterEach, vi } from "vitest";
import { Logger } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { nodeReleaseData } from "#api/db/schema.js";
import { NODE_RELEASES } from "#shared/engines/nodeReleases.js";
import type { INodeRelease } from "#shared/engines/types.js";
import { NodeReleaseDataService } from "../abstractions/NodeReleaseDataService.js";
import { NodeReleaseDataService as NodeReleaseDataServiceImpl } from "../NodeReleaseDataService.js";

const NODE_RELEASES_API_URL = "https://endoflife.date/api/nodejs.json";
const DAY_MS = 24 * 60 * 60 * 1000;

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

interface ITestSetup {
    service: NodeReleaseDataService.Interface;
    db: TestDb;
    logger: Logger.Interface;
}

function createService(): ITestSetup {
    const { container, db } = createTestApiContainer();
    container.register(NodeReleaseDataServiceImpl);
    const service = container.resolve(NodeReleaseDataService);
    const logger = container.resolve(Logger);
    return { service, db, logger };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
    return new Response(JSON.stringify(body), { status: ok ? status : 500 });
}

interface IApiEntryOverrides {
    cycle?: string;
    releaseDate?: string;
    lts?: string | boolean;
    maintenance?: string;
    eol?: string | boolean;
    codename?: string;
}

function buildApiEntry(overrides: IApiEntryOverrides = {}): Record<string, unknown> {
    return {
        cycle: "22",
        releaseDate: "2024-04-24",
        lts: "2024-10-29",
        maintenance: "2025-10-21",
        eol: "2027-04-30",
        codename: "Jod",
        ...overrides
    };
}

async function seedRelease(
    db: TestDb,
    input: { version: number; fetchedAt: number }
): Promise<void> {
    await db.insert(nodeReleaseData).values({
        id: `seed-${input.version}`,
        version: input.version,
        codename: "SeedCodename",
        releaseDate: Date.UTC(2020, 0, 1),
        ltsStart: Date.UTC(2020, 6, 1),
        maintenanceStart: Date.UTC(2021, 0, 1),
        eolDate: Date.UTC(2022, 0, 1),
        fetchedAt: input.fetchedAt
    });
}

describe("NodeReleaseDataService", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe("getSchedule", () => {
        it("returns cached DB data when fresh (fetchedAt < 24h)", async () => {
            const { service, db } = createService();
            await seedRelease(db, { version: 20, fetchedAt: Date.now() - 1000 });
            const fetchSpy = vi.fn();
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.getSchedule();

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({ version: 20, codename: "SeedCodename" });
        });

        it("fetches from the API when the DB cache is stale", async () => {
            const { service, db } = createService();
            await seedRelease(db, { version: 20, fetchedAt: Date.now() - DAY_MS - 1000 });
            const fetchSpy = vi.fn(async (url: string) => {
                expect(url).toBe(NODE_RELEASES_API_URL);
                return jsonResponse([buildApiEntry()]);
            });
            vi.stubGlobal("fetch", fetchSpy);

            const result = await service.getSchedule();

            expect(fetchSpy).toHaveBeenCalledTimes(1);
            expect(result).toEqual<INodeRelease[]>([
                {
                    version: 22,
                    codename: "Jod",
                    releaseDate: Date.parse("2024-04-24"),
                    ltsStart: Date.parse("2024-10-29"),
                    maintenanceStart: Date.parse("2025-10-21"),
                    eolDate: Date.parse("2027-04-30")
                }
            ]);
        });

        it("falls back to stale DB data when the API fetch fails", async () => {
            const { service, db } = createService();
            await seedRelease(db, { version: 20, fetchedAt: Date.now() - DAY_MS - 1000 });
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => {
                    throw new Error("network down");
                })
            );

            const result = await service.getSchedule();

            expect(result).toHaveLength(1);
            expect(result[0]).toMatchObject({ version: 20, codename: "SeedCodename" });
        });

        it("falls back to the embedded NODE_RELEASES constant when the DB is empty and the API fails", async () => {
            const { service } = createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => {
                    throw new Error("network down");
                })
            );

            const result = await service.getSchedule();

            expect(result).toEqual(NODE_RELEASES);
        });

        it("falls back to the embedded NODE_RELEASES constant when the API responds with a non-OK status", async () => {
            const { service } = createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => jsonResponse({}, false))
            );

            const result = await service.getSchedule();

            expect(result).toEqual(NODE_RELEASES);
        });

        it("upserts fetched data into the nodeReleaseData table", async () => {
            const { service, db } = createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => jsonResponse([buildApiEntry()]))
            );

            await service.getSchedule();

            const rows = await db.select().from(nodeReleaseData).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                version: 22,
                codename: "Jod",
                eolDate: Date.parse("2027-04-30")
            });
            expect(rows[0]!.fetchedAt).toBeGreaterThan(Date.now() - 5000);
        });

        it("updates the existing row on conflict instead of duplicating it", async () => {
            const { service, db } = createService();
            await seedRelease(db, { version: 22, fetchedAt: Date.now() - DAY_MS - 1000 });
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => jsonResponse([buildApiEntry({ codename: "UpdatedName" })]))
            );

            await service.getSchedule();

            const rows = await db.select().from(nodeReleaseData).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ version: 22, codename: "UpdatedName" });
        });

        it("rejects a malformed API response via Zod validation and falls back", async () => {
            const { service } = createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => jsonResponse([{ cycle: "22" }]))
            );

            const result = await service.getSchedule();

            expect(result).toEqual(NODE_RELEASES);
        });

        it("skips entries whose cycle isn't a plain major-version integer", async () => {
            const { service } = createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () =>
                    jsonResponse([buildApiEntry({ cycle: "0.12" }), buildApiEntry({ cycle: "22" })])
                )
            );

            const result = await service.getSchedule();

            expect(result).toHaveLength(1);
            expect(result[0]?.version).toBe(22);
        });

        it("treats lts: false as no LTS start date", async () => {
            const { service } = createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => jsonResponse([buildApiEntry({ lts: false, codename: "" })]))
            );

            const result = await service.getSchedule();

            expect(result[0]?.ltsStart).toBeNull();
            expect(result[0]?.codename).toBeNull();
        });

        it("skips entries where eol is true (no known EOL date)", async () => {
            const { service } = createService();
            vi.stubGlobal(
                "fetch",
                vi.fn(async () =>
                    jsonResponse([
                        buildApiEntry({ cycle: "10", eol: true }),
                        buildApiEntry({ cycle: "22" })
                    ])
                )
            );

            const result = await service.getSchedule();

            expect(result).toHaveLength(1);
            expect(result[0]?.version).toBe(22);
        });

        it("logs an error and still returns fresh API data when the DB upsert fails", async () => {
            const { service, db, logger } = createService();
            const loggerErrorSpy = vi.spyOn(logger, "error");
            vi.stubGlobal(
                "fetch",
                vi.fn(async () => jsonResponse([buildApiEntry()]))
            );
            vi.spyOn(db, "insert").mockImplementation(() => {
                throw new Error("disk full");
            });

            const result = await service.getSchedule();

            expect(result).toEqual<INodeRelease[]>([
                {
                    version: 22,
                    codename: "Jod",
                    releaseDate: Date.parse("2024-04-24"),
                    ltsStart: Date.parse("2024-10-29"),
                    maintenanceStart: Date.parse("2025-10-21"),
                    eolDate: Date.parse("2027-04-30")
                }
            ]);
            expect(loggerErrorSpy).toHaveBeenCalledWith(
                "Failed to persist Node.js release schedule to database",
                expect.objectContaining({ error: expect.any(String) })
            );
        });
    });
});
