import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { changelogs, dependencies, dependencyVersions } from "#api/db/schema.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { FileConfigService } from "../abstractions/FileConfigService.js";
import { RegistryCacheService as RegistryCacheServiceRegistration } from "../RegistryCacheService.js";
import { PackageManagerDriverRegistry as RegistryRegistration } from "../packageManagers/PackageManagerDriverRegistry.js";
import { ChangelogService } from "../abstractions/ChangelogService.js";
import { ChangelogService as ChangelogServiceRegistration } from "../ChangelogService.js";
import { GitHubReleasesResolver } from "../changelogResolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "../changelogResolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "../changelogResolvers/NpmReadmeResolver.js";

function createStubFileConfigService(): FileConfigService.Interface {
    return {
        readConfig: async () => null,
        readGlobalSettings: async () => ({ settings: null }),
        readGlobalConfig: async () => ({ config: null }),
        writeGlobalPmSettings: async () => {}
    };
}

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

async function createService(
    db: Awaited<ReturnType<typeof createTestDb>>,
    options: CreateServiceOptions = {}
): Promise<ChangelogService.Interface> {
    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
    container.registerInstance(CommandRunner, {
        run: options.runHandler ?? defaultRunHandler(),
        runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
    });
    container.register(RegistryRegistration).inSingletonScope();
    container.registerInstance(FileConfigService, createStubFileConfigService());
    container.register(RegistryCacheServiceRegistration).inSingletonScope();
    container.register(GitHubReleasesResolver);
    container.register(ChangelogFileResolver);
    container.register(NpmReadmeResolver);
    container.register(ChangelogServiceRegistration).inSingletonScope();
    return container.resolve(ChangelogService);
}

const dependencyIds = new Map<string, string>();

async function getOrCreateDependency(
    db: Awaited<ReturnType<typeof createTestDb>>,
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
    db: Awaited<ReturnType<typeof createTestDb>>,
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
    db: Awaited<ReturnType<typeof createTestDb>>,
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
    let db: Awaited<ReturnType<typeof createTestDb>>;

    beforeEach(async () => {
        db = await createTestDb();
        dependencyIds.clear();
    });

    it("resolve() fetches unfetched rows and updates their content from the winning resolver", async () => {
        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            repoUrl: "https://github.com/owner/repo"
        });

        const service = await createService(db, {
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

        await service.resolve("some-package");

        const rows = await queryChangelogRows(db, "some-package");
        const row = rows[0];

        expect(row?.content).toBe("release notes for 1.0.0");
        expect(row?.source).toBe("github-releases");
        expect(row?.fetchedAt).not.toBeNull();
    });

    it("resolve() skips rows that already have content set", async () => {
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

        const service = await createService(db, {
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

        const service = await createService(db, {
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
        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            repoUrl: "https://github.com/owner/repo",
            content: "already fetched",
            source: "manual",
            fetchedAt: 123
        });

        const service = await createService(db);

        await expect(service.resolve("some-package")).resolves.toBeUndefined();

        const rows = await queryChangelogRows(db, "some-package");
        expect(rows[0]?.content).toBe("already fetched");
    });

    it("getChangelogs() returns rows within (from, to] sorted by version", async () => {
        for (const version of ["1.0.0", "1.5.0", "2.0.0", "2.5.0", "3.0.0"]) {
            await insertChangelogRow(db, {
                packageName: "some-package",
                version,
                content: `notes for ${version}`,
                source: "github-releases",
                fetchedAt: Date.now()
            });
        }

        const service = await createService(db);

        const result = await service.getChangelogs("some-package", "1.0.0", "2.5.0");

        expect(result.map(entry => entry.version)).toEqual(["1.5.0", "2.0.0", "2.5.0"]);
        expect(result[0]?.content).toBe("notes for 1.5.0");
    });

    it("getChangelogs() returns an empty array when no rows fall in range", async () => {
        await insertChangelogRow(db, {
            packageName: "some-package",
            version: "1.0.0",
            content: "notes",
            source: "github-releases",
            fetchedAt: Date.now()
        });

        const service = await createService(db);

        const result = await service.getChangelogs("some-package", "1.0.0", "1.0.0");

        expect(result).toEqual([]);
    });
});
