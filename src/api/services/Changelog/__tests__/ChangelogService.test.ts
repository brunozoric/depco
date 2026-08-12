import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { changelogs, dependencies, dependencyVersions } from "#api/db/schema.js";
import { CommandRunner } from "../../CommandRunner/index.js";
import { ChangelogService } from "../abstractions/ChangelogService.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

type RunHandler = CommandRunner.Interface["run"];

interface CreateServiceOptions {
    runHandler?: RunHandler;
}

function defaultRunHandler(): RunHandler {
    return async (_command, args) => {
        if (args.includes("--version")) {
            return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
        }
        return { stdout: "", stderr: "not found", exitCode: 1 };
    };
}

function createService(options: CreateServiceOptions = {}): {
    service: ChangelogService.Interface;
    db: TestDb;
} {
    const { container, db } = createTestApiContainer();
    container.registerInstance(CommandRunner, {
        run: options.runHandler ?? defaultRunHandler(),
        runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    });
    const service = container.resolve(ChangelogService);
    return { service, db };
}

const dependencyIds = new Map<string, string>();

async function getOrCreateDependency(
    db: TestDb,
    packageName: string,
    repoUrl?: string | null
): Promise<string> {
    const existing = dependencyIds.get(packageName);
    if (existing) {
        return existing;
    }

    const id = generateId();
    await db
        .insert(dependencies)
        .values({
            id,
            name: packageName,
            repoUrl: repoUrl ?? null,
            createdAt: Date.now()
        })
        .run();
    dependencyIds.set(packageName, id);
    return id;
}

async function insertChangelogRow(
    db: TestDb,
    row: {
        packageName: string;
        version: string;
        repoUrl?: string | null;
        content?: string | null;
        source?: string | null;
        fetchedAt?: number | null;
    }
): Promise<string> {
    const dependencyId = await getOrCreateDependency(db, row.packageName, row.repoUrl);

    const versionId = generateId();
    await db
        .insert(dependencyVersions)
        .values({
            id: versionId,
            dependencyId,
            version: row.version,
            publishedAt: null
        })
        .run();

    const id = generateId();
    await db
        .insert(changelogs)
        .values({
            id,
            dependencyId,
            dependencyVersionId: versionId,
            content: row.content ?? null,
            source: row.source ?? null,
            fetchedAt: row.fetchedAt ?? null
        })
        .run();
    return id;
}

async function queryChangelogRows(
    db: TestDb,
    packageName: string
): Promise<
    Array<{
        id: string;
        version: string;
        content: string | null;
        source: string | null;
        fetchedAt: number | null;
    }>
> {
    const depId = dependencyIds.get(packageName);
    if (!depId) {
        return [];
    }

    return db
        .select({
            id: changelogs.id,
            version: dependencyVersions.version,
            content: changelogs.content,
            source: changelogs.source,
            fetchedAt: changelogs.fetchedAt
        })
        .from(changelogs)
        .innerJoin(dependencyVersions, eq(changelogs.dependencyVersionId, dependencyVersions.id))
        .where(eq(changelogs.dependencyId, depId))
        .all();
}

describe("ChangelogService", () => {
    beforeEach(() => {
        dependencyIds.clear();
    });

    it("resolve() fetches unfetched rows and updates their content from the winning resolver", async () => {
        const { service, db } = createService({
            runHandler: async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                if (args.some(arg => arg.includes("releases"))) {
                    return {
                        stdout: JSON.stringify([
                            { tag_name: "v1.0.0", body: "release notes for 1.0.0" }
                        ]),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            }
        });

        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            repoUrl: "https://github.com/owner/repo"
        });

        await service.resolve("some-package");

        const rows = await queryChangelogRows(db, "some-package");
        const row = rows[0];

        expect(row?.content).toBe("release notes for 1.0.0");
        expect(row?.source).toBe("github-releases");
        expect(row?.fetchedAt).not.toBeNull();
    });

    it("resolve() skips rows that already have content set", async () => {
        const { service, db } = createService({
            runHandler: async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                if (args.some(arg => arg.includes("releases"))) {
                    return {
                        stdout: JSON.stringify([
                            { tag_name: "v2.0.0", body: "release notes for 2.0.0" }
                        ]),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            }
        });

        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            repoUrl: "https://github.com/owner/repo",
            content: "already fetched",
            source: "manual",
            fetchedAt: 123
        });
        const unfetchedId = await insertChangelogRow(db, {
            packageName: "some-package",
            version: "2.0.0",
            repoUrl: "https://github.com/owner/repo"
        });

        await service.resolve("some-package");

        const rows = await queryChangelogRows(db, "some-package");

        const existingRow = rows.find(row => row.version === "1.0.0");
        expect(existingRow?.content).toBe("already fetched");
        expect(existingRow?.source).toBe("manual");
        expect(existingRow?.fetchedAt).toBe(123);

        const updatedRow = rows.find(row => row.id === unfetchedId);
        expect(updatedRow?.content).toBe("release notes for 2.0.0");
        expect(updatedRow?.source).toBe("github-releases");
    });

    it("resolve() marks versions not covered by the winning resolver with empty content and source 'none'", async () => {
        const { service, db } = createService({
            runHandler: async (_command, args) => {
                if (args.includes("--version")) {
                    return { stdout: "gh version 2.0.0", stderr: "", exitCode: 0 };
                }
                if (args.some(arg => arg.includes("releases"))) {
                    // Only version 1.0.0 has a matching release.
                    return {
                        stdout: JSON.stringify([
                            { tag_name: "v1.0.0", body: "release notes for 1.0.0" }
                        ]),
                        stderr: "",
                        exitCode: 0
                    };
                }
                return { stdout: "", stderr: "not found", exitCode: 1 };
            }
        });

        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            repoUrl: "https://github.com/owner/repo"
        });
        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "2.0.0",
            repoUrl: "https://github.com/owner/repo"
        });

        await service.resolve("some-package");

        const rows = await queryChangelogRows(db, "some-package");

        const matched = rows.find(row => row.version === "1.0.0");
        expect(matched?.content).toBe("release notes for 1.0.0");
        expect(matched?.source).toBe("github-releases");

        const unmatched = rows.find(row => row.version === "2.0.0");
        expect(unmatched?.content).toBe("");
        expect(unmatched?.source).toBe("none");
        expect(unmatched?.fetchedAt).not.toBeNull();
    });

    it("resolve() does nothing when there are no unfetched rows for the package", async () => {
        const { service, db } = createService();

        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            repoUrl: "https://github.com/owner/repo",
            content: "already fetched",
            source: "manual",
            fetchedAt: 123
        });

        await expect(service.resolve("some-package")).resolves.toBeUndefined();

        const rows = await queryChangelogRows(db, "some-package");
        expect(rows[0]?.content).toBe("already fetched");
    });

    it("getChangelogs() returns rows within (from, to] sorted by version", async () => {
        const { service, db } = createService();

        for (const version of ["1.0.0", "1.5.0", "2.0.0", "2.5.0", "3.0.0"]) {
            await insertChangelogRow(db, {
                packageName: "some-package",
                version,
                content: `notes for ${version}`,
                source: "github-releases",
                fetchedAt: Date.now()
            });
        }

        const result = await service.getChangelogs("some-package", "1.0.0", "2.5.0");

        expect(result.map(entry => entry.version)).toEqual(["1.5.0", "2.0.0", "2.5.0"]);
        expect(result[0]?.content).toBe("notes for 1.5.0");
    });

    it("resetAllFailed() resets source='none' rows across all packages and returns affected packages", async () => {
        const { service, db } = createService();

        await insertChangelogRow(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });
        await insertChangelogRow(db, {
            packageName: "react",
            version: "18.2.0",
            repoUrl: "https://github.com/facebook/react",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });
        await insertChangelogRow(db, {
            packageName: "lodash",
            version: "4.17.21",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });
        await insertChangelogRow(db, {
            packageName: "lodash",
            version: "4.17.20",
            content: "real content",
            source: "github",
            fetchedAt: Date.now()
        });

        const result = await service.resetAllFailed();

        expect(result).toHaveLength(2);
        const sorted = result.sort((a, b) => a.packageName.localeCompare(b.packageName));
        expect(sorted[0]).toEqual({
            packageName: "lodash",
            minVersion: "4.17.21",
            maxVersion: "4.17.21"
        });
        expect(sorted[1]).toEqual({
            packageName: "react",
            minVersion: "18.1.0",
            maxVersion: "18.2.0"
        });

        const reactRows = await queryChangelogRows(db, "react");
        for (const row of reactRows) {
            expect(row.content).toBeNull();
            expect(row.source).toBeNull();
            expect(row.fetchedAt).toBeNull();
        }

        const lodashRows = await queryChangelogRows(db, "lodash");
        const resetRow = lodashRows.find(row => row.version === "4.17.21");
        expect(resetRow?.content).toBeNull();
        const keptRow = lodashRows.find(row => row.version === "4.17.20");
        expect(keptRow?.content).toBe("real content");
    });

    it("resetAllFailed() returns empty array when no failed changelogs exist", async () => {
        const { service, db } = createService();

        await insertChangelogRow(db, {
            packageName: "react",
            version: "18.1.0",
            content: "real content",
            source: "github",
            fetchedAt: Date.now()
        });

        const result = await service.resetAllFailed();
        expect(result).toEqual([]);
    });

    it("getChangelogs() returns an empty array when no rows fall in range", async () => {
        const { service, db } = createService();

        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            content: "notes",
            source: "github-releases",
            fetchedAt: Date.now()
        });

        const result = await service.getChangelogs("some-package", "1.0.0", "1.0.0");

        expect(result).toEqual([]);
    });

    it("getStats() returns correct counts and resolver breakdown", async () => {
        const { service, db } = createService();

        await insertChangelogRow(db, {
            packageName: "pkg-a",
            version: "1.0.0",
            content: "notes",
            source: "github-releases",
            fetchedAt: Date.now()
        });
        await insertChangelogRow(db, {
            packageName: "pkg-a",
            version: "2.0.0",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });
        await insertChangelogRow(db, {
            packageName: "pkg-b",
            version: "1.0.0",
            content: null,
            source: null,
            fetchedAt: null
        });

        const stats = await service.getStats();

        expect(stats.total).toBe(3);
        expect(stats.resolved).toBe(1);
        expect(stats.failed).toBe(1);
        expect(stats.pending).toBe(1);
        expect(stats.byResolver).toEqual({ "github-releases": 1 });
    });
});
