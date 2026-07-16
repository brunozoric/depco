import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { PackageManagerService } from "#api/services/abstractions/PackageManagerService.js";
import {
    appSettings,
    projects,
    pmSecuritySettings,
    dependencies,
    dependencyVersions,
    changelogs,
    registryCache
} from "#api/db/schema.js";
import { backupRoutes } from "../backup.js";

interface BackupVersionEntry {
    version: string;
    publishedAt: number | null;
    changelog?: { content: string | null; source: string | null };
}

interface BackupDependencyEntry {
    name: string;
    repoUrl: string | null;
    versions: BackupVersionEntry[];
}

interface BackupExport {
    version: number;
    exportedAt: number;
    appSettings: Array<{ key: string; value: string }>;
    securitySettings: Array<{
        packageManager: string;
        configFile: string;
        fieldName: string;
        expectedValue: string;
    }>;
    projects: Array<{
        name: string;
        path: string;
        packageManager: string | null;
        pmVersion: string | null;
    }>;
    dependencies: BackupDependencyEntry[];
    registryCache: Array<{ packageName: string; data: string; cachedAt: number }>;
}

function zipPayload(payload: Record<string, unknown>): Buffer {
    const jsonBytes = strToU8(JSON.stringify(payload));
    const zipped = zipSync({ "backup.json": jsonBytes });
    return Buffer.from(zipped.buffer, zipped.byteOffset, zipped.byteLength);
}

function unzipBackup(buffer: Buffer): BackupExport {
    const unzipped = unzipSync(new Uint8Array(buffer));
    const content = strFromU8(unzipped["backup.json"]!);
    return JSON.parse(content) as BackupExport;
}

describe("backup routes", () => {
    let app: FastifyInstance;
    let db: Awaited<ReturnType<typeof createTestDb>>;

    beforeEach(async () => {
        db = await createTestDb();
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(PackageManagerService, {
            detect: async () => "pnpm",
            getVersion: async () => "11.0.0",
            updateVersion: async () => {},
            audit: async () => []
        });
        app = Fastify();
        await app.register(backupRoutes, { container });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    describe("GET /api/projects/backup", () => {
        it("returns zip with empty backup when DB is empty", async () => {
            const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
            expect(response.statusCode).toBe(200);
            expect(response.headers["content-type"]).toBe("application/zip");

            const body = unzipBackup(response.rawPayload);
            expect(body.version).toBe(1);
            expect(typeof body.exportedAt).toBe("number");
            expect(body.appSettings).toEqual([]);
            expect(body.securitySettings).toEqual([]);
            expect(body.projects).toEqual([]);
            expect(body.dependencies).toEqual([]);
            expect(body.registryCache).toEqual([]);
        });

        it("exports app settings, projects, and security settings", async () => {
            await db
                .insert(appSettings)
                .values([
                    { key: "branch_template", value: "chore/${YYYY}" },
                    { key: "log_level", value: "warn" }
                ])
                .run();

            await db
                .insert(projects)
                .values({
                    id: "p1",
                    name: "test-proj",
                    path: "/tmp/test",
                    packageManager: "pnpm",
                    pmVersion: "11.0.0",
                    addedAt: 1000
                })
                .run();

            await db
                .insert(pmSecuritySettings)
                .values({
                    id: "s1",
                    packageManager: "pnpm",
                    configFile: "pnpm-workspace.yaml",
                    fieldName: "ignoreScripts",
                    expectedValue: "true"
                })
                .run();

            const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
            const body = unzipBackup(response.rawPayload);

            expect(body.appSettings).toHaveLength(2);
            expect(body.projects).toHaveLength(1);
            expect(body.projects[0]!.name).toBe("test-proj");
            expect(body.projects[0]).not.toHaveProperty("id");
            expect(body.projects[0]).not.toHaveProperty("addedAt");
            expect(body.securitySettings).toHaveLength(1);
            expect(body.securitySettings[0]).not.toHaveProperty("id");
        });

        it("exports dependencies with nested versions and changelogs", async () => {
            await db
                .insert(dependencies)
                .values({
                    id: "d1",
                    name: "react",
                    repoUrl: "https://github.com/facebook/react",
                    createdAt: 1000
                })
                .run();

            await db
                .insert(dependencyVersions)
                .values([
                    { id: "v1", dependencyId: "d1", version: "19.0.0", publishedAt: 2000 },
                    { id: "v2", dependencyId: "d1", version: "18.0.0", publishedAt: 1000 }
                ])
                .run();

            await db
                .insert(changelogs)
                .values({
                    id: "cl1",
                    dependencyId: "d1",
                    dependencyVersionId: "v1",
                    content: "Breaking changes",
                    source: "github",
                    fetchedAt: 3000
                })
                .run();

            const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
            const body = unzipBackup(response.rawPayload);

            expect(body.dependencies).toHaveLength(1);
            const dep = body.dependencies[0]!;
            expect(dep.name).toBe("react");
            expect(dep.versions).toHaveLength(2);

            const v19 = dep.versions.find(v => v.version === "19.0.0")!;
            expect(v19.changelog).toEqual({ content: "Breaking changes", source: "github" });

            const v18 = dep.versions.find(v => v.version === "18.0.0")!;
            expect(v18.changelog).toBeUndefined();
        });

        it("exports dependency with zero versions as empty array", async () => {
            await db
                .insert(dependencies)
                .values({ id: "d1", name: "lodash", repoUrl: null, createdAt: 1000 })
                .run();

            const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
            const body = unzipBackup(response.rawPayload);
            expect(body.dependencies[0]!.versions).toEqual([]);
        });

        it("exports changelog with null content", async () => {
            await db
                .insert(dependencies)
                .values({ id: "d1", name: "react", repoUrl: null, createdAt: 1000 })
                .run();
            await db
                .insert(dependencyVersions)
                .values({ id: "v1", dependencyId: "d1", version: "19.0.0", publishedAt: 2000 })
                .run();
            await db
                .insert(changelogs)
                .values({
                    id: "cl1",
                    dependencyId: "d1",
                    dependencyVersionId: "v1",
                    content: null,
                    source: "github",
                    fetchedAt: 3000
                })
                .run();

            const response = await app.inject({ method: "GET", url: "/api/projects/backup" });
            const body = unzipBackup(response.rawPayload);
            expect(body.dependencies[0]!.versions[0]!.changelog).toEqual({
                content: null,
                source: "github"
            });
        });
    });

    describe("POST /api/projects/backup", () => {
        function makeBackup(overrides: Record<string, unknown> = {}) {
            return {
                version: 1,
                exportedAt: Date.now(),
                appSettings: [],
                securitySettings: [],
                projects: [],
                dependencies: [],
                registryCache: [],
                ...overrides
            };
        }

        function injectImport(payload: Record<string, unknown>) {
            return app.inject({
                method: "POST",
                url: "/api/projects/backup",
                payload: zipPayload(payload),
                headers: { "content-type": "application/octet-stream" }
            });
        }

        it("imports app settings", async () => {
            const response = await injectImport(
                makeBackup({
                    appSettings: [
                        { key: "branch_template", value: "chore/${YYYY}" },
                        { key: "log_level", value: "warn" }
                    ]
                })
            );

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.appSettings).toEqual({ imported: 2, skipped: 0 });

            const rows = await db.select().from(appSettings).all();
            expect(rows).toHaveLength(2);
        });

        it("skips existing app settings on import", async () => {
            await db.insert(appSettings).values({ key: "log_level", value: "error" }).run();

            const response = await injectImport(
                makeBackup({
                    appSettings: [{ key: "log_level", value: "warn" }]
                })
            );

            const body = response.json();
            expect(body.appSettings).toEqual({ imported: 0, skipped: 1 });

            const row = await db.select().from(appSettings).all();
            expect(row[0]!.value).toBe("error");
        });

        it("imports security settings", async () => {
            const response = await injectImport(
                makeBackup({
                    securitySettings: [
                        {
                            packageManager: "pnpm",
                            configFile: "pnpm-workspace.yaml",
                            fieldName: "ignoreScripts",
                            expectedValue: "true"
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.securitySettings).toEqual({ imported: 1, skipped: 0 });

            const rows = await db.select().from(pmSecuritySettings).all();
            expect(rows).toHaveLength(1);
            expect(rows[0]!.id).toBeTruthy();
        });

        it("skips duplicate security settings on import", async () => {
            await db
                .insert(pmSecuritySettings)
                .values({
                    id: "existing",
                    packageManager: "pnpm",
                    configFile: "pnpm-workspace.yaml",
                    fieldName: "ignoreScripts",
                    expectedValue: "true"
                })
                .run();

            const response = await injectImport(
                makeBackup({
                    securitySettings: [
                        {
                            packageManager: "pnpm",
                            configFile: "pnpm-workspace.yaml",
                            fieldName: "ignoreScripts",
                            expectedValue: "false"
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.securitySettings).toEqual({ imported: 0, skipped: 1 });
        });

        it("imports registry cache", async () => {
            const response = await injectImport(
                makeBackup({
                    registryCache: [
                        { packageName: "react", data: '{"versions":{}}', cachedAt: 1000 }
                    ]
                })
            );

            const body = response.json();
            expect(body.registryCache).toEqual({ imported: 1, skipped: 0 });
        });

        it("skips existing registry cache entries", async () => {
            await db
                .insert(registryCache)
                .values({ packageName: "react", data: '{"old":true}', cachedAt: 500 })
                .run();

            const response = await injectImport(
                makeBackup({
                    registryCache: [{ packageName: "react", data: '{"new":true}', cachedAt: 1000 }]
                })
            );

            const body = response.json();
            expect(body.registryCache).toEqual({ imported: 0, skipped: 1 });
        });

        it("imports projects when path exists", async () => {
            const response = await injectImport(
                makeBackup({
                    projects: [
                        {
                            name: "test",
                            path: process.cwd(),
                            packageManager: "pnpm",
                            pmVersion: "11.0.0"
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.projects.imported).toBe(1);
            expect(body.projects.failed).toBe(0);

            const rows = await db.select().from(projects).all();
            expect(rows).toHaveLength(1);
        });

        it("fails project import when path does not exist", async () => {
            const response = await injectImport(
                makeBackup({
                    projects: [
                        {
                            name: "ghost",
                            path: "/nonexistent/path/xyz",
                            packageManager: null,
                            pmVersion: null
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.projects.imported).toBe(0);
            expect(body.projects.failed).toBe(1);
            expect(body.projects.errors[0]).toContain("/nonexistent/path/xyz");
        });

        it("skips project with duplicate path", async () => {
            await db
                .insert(projects)
                .values({
                    id: "existing",
                    name: "test",
                    path: process.cwd(),
                    packageManager: "pnpm",
                    addedAt: 1000
                })
                .run();

            const response = await injectImport(
                makeBackup({
                    projects: [
                        {
                            name: "test",
                            path: process.cwd(),
                            packageManager: "pnpm",
                            pmVersion: "11.0.0"
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.projects.imported).toBe(0);
            expect(body.projects.skipped).toBe(1);
        });

        it("imports dependencies with versions", async () => {
            const response = await injectImport(
                makeBackup({
                    dependencies: [
                        {
                            name: "react",
                            repoUrl: "https://github.com/facebook/react",
                            versions: [
                                { version: "19.0.0", publishedAt: 2000 },
                                { version: "18.0.0", publishedAt: 1000 }
                            ]
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.dependencies.imported).toBe(3);
            expect(body.dependencies.skipped).toBe(0);

            const deps = await db.select().from(dependencies).all();
            expect(deps).toHaveLength(1);
            expect(deps[0]!.name).toBe("react");

            const versions = await db.select().from(dependencyVersions).all();
            expect(versions).toHaveLength(2);
        });

        it("imports dependencies with changelogs", async () => {
            const response = await injectImport(
                makeBackup({
                    dependencies: [
                        {
                            name: "react",
                            repoUrl: null,
                            versions: [
                                {
                                    version: "19.0.0",
                                    publishedAt: 2000,
                                    changelog: { content: "Breaking changes", source: "github" }
                                },
                                { version: "18.0.0", publishedAt: 1000 }
                            ]
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.dependencies.imported).toBe(4);

            const cls = await db.select().from(changelogs).all();
            expect(cls).toHaveLength(1);
            expect(cls[0]!.content).toBe("Breaking changes");
            expect(cls[0]!.source).toBe("github");
        });

        it("skips existing dependencies and versions on re-import", async () => {
            const backup = makeBackup({
                dependencies: [
                    {
                        name: "react",
                        repoUrl: null,
                        versions: [{ version: "19.0.0", publishedAt: 2000 }]
                    }
                ]
            });

            await injectImport(backup);
            const response = await injectImport(backup);

            const body = response.json();
            expect(body.dependencies.imported).toBe(0);
            expect(body.dependencies.skipped).toBe(2);
        });

        it("imports changelog with null content", async () => {
            const response = await injectImport(
                makeBackup({
                    dependencies: [
                        {
                            name: "react",
                            repoUrl: null,
                            versions: [
                                {
                                    version: "19.0.0",
                                    publishedAt: 2000,
                                    changelog: { content: null, source: null }
                                }
                            ]
                        }
                    ]
                })
            );

            const body = response.json();
            expect(body.dependencies.imported).toBe(3);

            const cls = await db.select().from(changelogs).all();
            expect(cls).toHaveLength(1);
            expect(cls[0]!.content).toBeNull();
            expect(cls[0]!.source).toBeNull();
        });

        it("roundtrip: export then import into empty DB", async () => {
            await db.insert(appSettings).values({ key: "log_level", value: "warn" }).run();
            await db
                .insert(dependencies)
                .values({
                    id: "d1",
                    name: "react",
                    repoUrl: null,
                    createdAt: 1000
                })
                .run();
            await db
                .insert(dependencyVersions)
                .values({
                    id: "v1",
                    dependencyId: "d1",
                    version: "19.0.0",
                    publishedAt: 2000
                })
                .run();
            await db
                .insert(changelogs)
                .values({
                    id: "cl1",
                    dependencyId: "d1",
                    dependencyVersionId: "v1",
                    content: "changes",
                    source: "github",
                    fetchedAt: 3000
                })
                .run();

            const exportResponse = await app.inject({ method: "GET", url: "/api/projects/backup" });
            const zipBuffer = exportResponse.rawPayload;

            await db.delete(changelogs).run();
            await db.delete(dependencyVersions).run();
            await db.delete(dependencies).run();
            await db.delete(appSettings).run();

            const importResponse = await app.inject({
                method: "POST",
                url: "/api/projects/backup",
                payload: zipBuffer,
                headers: { "content-type": "application/octet-stream" }
            });

            const body = importResponse.json();
            expect(body.appSettings.imported).toBe(1);
            expect(body.dependencies.imported).toBe(3);

            const cls = await db.select().from(changelogs).all();
            expect(cls).toHaveLength(1);
            expect(cls[0]!.content).toBe("changes");
        });
    });
});
