import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { CommandRunner } from "../../services/CommandRunner/index.js";
import { EmailService } from "../../services/Email/index.js";
import { UserService as UserServiceRegistration } from "../../services/UserService.js";
import { AuthService as AuthServiceRegistration } from "../../services/AuthService.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { FileConfigService } from "../../services/FileConfig/index.js";
import { RegistryCacheService as RegistryCacheServiceReg } from "../../services/RegistryCache/RegistryCacheService.js";
import { ChangelogService as ChangelogServiceReg } from "../../services/ChangelogService.js";
import { GitHubReleasesResolver } from "../../services/Changelog/resolvers/GitHubReleasesResolver.js";
import { ChangelogFileResolver } from "../../services/Changelog/resolvers/ChangelogFileResolver.js";
import { NpmReadmeResolver } from "../../services/Changelog/resolvers/NpmReadmeResolver.js";
import { PackageManagerDriverRegistry as PackageManagerDriverRegistryReg } from "../../services/PackageManager/PackageManagerDriverRegistry.js";
import { generateId } from "@webiny/stdlib";
import { changelogs, dependencies, dependencyVersions, upgradeJobs } from "#api/db/schema.js";
import { changelogRoutes } from "../changelogs.js";
import { eq } from "drizzle-orm";
import { JobWorker } from "../../services/JobExecution/index.js";

function createStubFileConfigService(): FileConfigService.Interface {
    return {
        readConfig: async () => null,
        readGlobalSettings: async () => ({ settings: null }),
        readGlobalConfig: async () => ({ config: null }),
        writeGlobalPmSettings: async () => {}
    };
}

async function insertChangelogFixture(
    db: Awaited<ReturnType<typeof createTestDb>>,
    row: {
        packageName: string;
        version: string;
        repoUrl?: string | null;
        content?: string | null;
        source?: string | null;
        fetchedAt?: number | null;
    }
): Promise<void> {
    let depRow = await db
        .select()
        .from(dependencies)
        .where(eq(dependencies.name, row.packageName))
        .get();

    if (!depRow) {
        const depId = generateId();
        await db
            .insert(dependencies)
            .values({
                id: depId,
                name: row.packageName,
                repoUrl: row.repoUrl ?? null,
                repoDirectory: null,
                createdAt: Date.now()
            })
            .run();
        depRow = {
            id: depId,
            name: row.packageName,
            repoUrl: row.repoUrl ?? null,
            repoDirectory: null,
            createdAt: Date.now()
        };
    }

    expect(depRow).toBeDefined();

    const versionId = generateId();
    await db
        .insert(dependencyVersions)
        .values({
            id: versionId,
            dependencyId: depRow!.id,
            version: row.version,
            publishedAt: null
        })
        .run();

    await db
        .insert(changelogs)
        .values({
            id: generateId(),
            dependencyId: depRow!.id,
            dependencyVersionId: versionId,
            content: row.content ?? null,
            source: row.source ?? null,
            fetchedAt: row.fetchedAt ?? null
        })
        .run();
}

describe("changelog routes", () => {
    let app: FastifyInstance;
    let db: Awaited<ReturnType<typeof createTestDb>>;
    let enqueuedJobs: JobWorker.CreateJobInput[];
    let token: string;

    beforeEach(async () => {
        db = await createTestDb();
        enqueuedJobs = [];

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(CommandRunner, {
            run: async () => ({
                stdout: "",
                stderr: "",
                exitCode: 0
            }),
            runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
        });
        container.register(PackageManagerDriverRegistryReg).inSingletonScope();
        container.registerInstance(FileConfigService, createStubFileConfigService());
        container.register(RegistryCacheServiceReg).inSingletonScope();
        container.register(GitHubReleasesResolver);
        container.register(ChangelogFileResolver);
        container.register(NpmReadmeResolver);
        container.register(ChangelogServiceReg).inSingletonScope();
        container.registerInstance(JobWorker, {
            enqueue: async input => {
                enqueuedJobs.push(input);
                return "stub-job-id";
            },
            getJob: async () => null,
            getJobsForReference: async () => [],
            processNextJob: async () => {},
            cancelJob: async () => {},
            listAllJobs: async () => [],
            drain: async () => {},
            recoverStaleJobs: async () => {},
            waitForJob: async () => {
                throw new Error("not implemented");
            },
            waitForJobs: async () => [],
            getRunningJobsForReference: async () => []
        });
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(changelogRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("GET /api/changelogs/:packageName returns empty array when no changelogs exist", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/changelogs/react?from=18.0.0&to=19.0.0"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toEqual([]);
        expect(json.total).toBe(0);
    });

    it("GET /api/changelogs/:packageName returns changelogs from DB when already fetched", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "## 18.1.0\n\nNew features",
            source: "github",
            fetchedAt: Date.now()
        });

        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.2.0",
            repoUrl: "https://github.com/facebook/react",
            content: "## 18.2.0\n\nBug fixes",
            source: "github",
            fetchedAt: Date.now()
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/changelogs/react?from=18.0.0&to=18.2.0"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(2);
        expect(json.total).toBe(2);
        expect(json.items[0]).toEqual({
            version: "18.1.0",
            content: "## 18.1.0\n\nNew features",
            source: "github"
        });
        expect(json.items[1]).toEqual({
            version: "18.2.0",
            content: "## 18.2.0\n\nBug fixes",
            source: "github"
        });
    });

    it("GET /api/changelogs/:packageName filters by version range", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.0.0",
            repoUrl: "https://github.com/facebook/react",
            content: "## 18.0.0",
            source: "github",
            fetchedAt: Date.now()
        });

        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "## 18.1.0",
            source: "github",
            fetchedAt: Date.now()
        });

        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.2.0",
            repoUrl: "https://github.com/facebook/react",
            content: "## 18.2.0",
            source: "github",
            fetchedAt: Date.now()
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/changelogs/react?from=18.0.0&to=18.1.5"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        // from=18.0.0 (exclusive) to=18.1.5 (inclusive) should return 18.1.0
        expect(json.items).toHaveLength(1);
        expect(json.items[0].version).toBe("18.1.0");
    });

    it("GET /api/changelogs/:packageName returns cached entries immediately and enqueues a changelog job for unfetched versions", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: null,
            source: null,
            fetchedAt: null
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/changelogs/react?from=18.0.0&to=18.2.0"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0]).toEqual({
            version: "18.1.0",
            content: null,
            source: null
        });
        expect(json.resolving).toBe(true);

        expect(enqueuedJobs).toHaveLength(1);
        expect(enqueuedJobs[0]).toMatchObject({
            referenceId: "react",
            referenceType: "package",
            type: "changelog"
        });
        expect(JSON.parse(enqueuedJobs[0]?.packages as string)).toEqual({
            packageName: "react",
            from: "18.0.0",
            to: "18.2.0"
        });
    });

    it("GET /api/changelogs/:packageName does not enqueue a duplicate job when one is already active", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: null,
            source: null,
            fetchedAt: null
        });

        await db
            .insert(upgradeJobs)
            .values({
                id: generateId(),
                referenceId: "react",
                referenceType: "package",
                type: "changelog",
                status: "pending",
                packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "18.2.0" })
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/changelogs/react?from=18.0.0&to=18.2.0"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);
        expect(enqueuedJobs).toHaveLength(0);
    });

    it("GET /api/changelogs/:packageName enqueues supplementary job when requested range extends beyond active job", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: null,
            source: null,
            fetchedAt: null
        });

        await insertChangelogFixture(db, {
            packageName: "react",
            version: "19.0.0",
            repoUrl: "https://github.com/facebook/react",
            content: null,
            source: null,
            fetchedAt: null
        });

        await db
            .insert(upgradeJobs)
            .values({
                id: generateId(),
                referenceId: "react",
                referenceType: "package",
                type: "changelog",
                status: "running",
                packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "18.2.0" })
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/changelogs/react?from=18.0.0&to=19.0.0"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);

        expect(enqueuedJobs).toHaveLength(1);
        const enqueued = JSON.parse(enqueuedJobs[0]?.packages as string);
        expect(enqueued.from).toBe("18.2.0");
        expect(enqueued.to).toBe("19.0.0");
    });

    it("GET /api/changelogs/:packageName does not enqueue when active job covers requested range", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: null,
            source: null,
            fetchedAt: null
        });

        await db
            .insert(upgradeJobs)
            .values({
                id: generateId(),
                referenceId: "react",
                referenceType: "package",
                type: "changelog",
                status: "pending",
                packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "19.0.0" })
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/changelogs/react?from=18.0.0&to=18.2.0"
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);
        expect(enqueuedJobs).toHaveLength(0);
    });

    it("POST /api/changelogs/:packageName/re-resolve resets failed entries and enqueues a job", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/changelogs/react/re-resolve",
            payload: { from: "18.0.0", to: "18.2.0" }
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);
        expect(json.items[0]).toEqual({
            version: "18.1.0",
            content: null,
            source: null
        });

        expect(enqueuedJobs).toHaveLength(1);
        expect(enqueuedJobs[0]).toMatchObject({
            referenceId: "react",
            referenceType: "package",
            type: "changelog"
        });
    });

    it("POST /api/changelogs/:packageName/re-resolve does not enqueue when active job exists", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });

        await db
            .insert(upgradeJobs)
            .values({
                id: generateId(),
                referenceId: "react",
                referenceType: "package",
                type: "changelog",
                status: "running",
                packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "18.2.0" })
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/changelogs/react/re-resolve",
            payload: { from: "18.0.0", to: "18.2.0" }
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);
        expect(enqueuedJobs).toHaveLength(0);
    });

    it("POST /api/changelogs/:packageName/re-resolve enqueues supplementary job when range extends beyond active job", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });

        await db
            .insert(upgradeJobs)
            .values({
                id: generateId(),
                referenceId: "react",
                referenceType: "package",
                type: "changelog",
                status: "running",
                packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "18.2.0" })
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/changelogs/react/re-resolve",
            payload: { from: "18.0.0", to: "19.0.0" }
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);

        expect(enqueuedJobs).toHaveLength(1);
        const enqueued = JSON.parse(enqueuedJobs[0]?.packages as string);
        expect(enqueued.from).toBe("18.2.0");
        expect(enqueued.to).toBe("19.0.0");
    });

    it("POST /api/changelogs/:packageName/re-resolve does not enqueue when active job covers requested range", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });

        await db
            .insert(upgradeJobs)
            .values({
                id: generateId(),
                referenceId: "react",
                referenceType: "package",
                type: "changelog",
                status: "pending",
                packages: JSON.stringify({ packageName: "react", from: "18.0.0", to: "19.0.0" })
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/changelogs/react/re-resolve",
            payload: { from: "18.0.0", to: "18.2.0" }
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);
        expect(enqueuedJobs).toHaveLength(0);
    });

    it("POST /api/changelogs/:packageName/re-resolve enqueues fresh job when active job has malformed packages", async () => {
        await insertChangelogFixture(db, {
            packageName: "react",
            version: "18.1.0",
            repoUrl: "https://github.com/facebook/react",
            content: "",
            source: "none",
            fetchedAt: Date.now()
        });

        await db
            .insert(upgradeJobs)
            .values({
                id: generateId(),
                referenceId: "react",
                referenceType: "package",
                type: "changelog",
                status: "running",
                packages: "not-valid-json"
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: "/api/changelogs/react/re-resolve",
            payload: { from: "18.0.0", to: "18.2.0" }
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.resolving).toBe(true);

        expect(enqueuedJobs).toHaveLength(1);
        const enqueued = JSON.parse(enqueuedJobs[0]?.packages as string);
        expect(enqueued.from).toBe("18.0.0");
        expect(enqueued.to).toBe("18.2.0");
    });
});
