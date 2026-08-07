import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "../../services/abstractions/JobWorker.js";
import { AutoFixSettingsService } from "../../services/AutoFixSettingsService.js";
import { EmailService } from "../../services/Email/index.js";
import { UserService as UserServiceRegistration } from "../../services/UserService.js";
import { AuthService as AuthServiceRegistration } from "../../services/AuthService.js";
import { createAuthHook } from "../../middleware/authHook.js";
import { projects, autoFixPullRequests } from "#api/db/schema.js";
import { autoFixSettingsRoutes } from "../autoFixSettings.js";
import { autoFixPrRoutes } from "../autoFixPrs.js";

type TestDatabaseClient = Awaited<ReturnType<typeof createTestDatabaseClient>>;

interface IRouteTestContext {
    app: FastifyInstance;
    databaseClient: TestDatabaseClient;
    enqueuedJobs: JobWorker.CreateJobInput[];
    token: string;
}

async function insertTestProject(
    databaseClient: TestDatabaseClient,
    id: string,
    name = id
): Promise<void> {
    await databaseClient.db
        .insert(projects)
        .values({
            id,
            name,
            path: `/repo/${id}`,
            packageManager: "yarn",
            addedAt: Date.now()
        })
        .run();
}

/**
 * Wires both the auto-fix settings routes and the auto-fix pull request
 * routes onto a single Fastify instance against a real SQLite database. Only
 * JobWorker is mocked, so the generate route can be asserted against without
 * exercising the full job pipeline.
 */
async function createTestContext(): Promise<IRouteTestContext> {
    const databaseClient = await createTestDatabaseClient();
    const enqueuedJobs: JobWorker.CreateJobInput[] = [];

    const container = createContainer();
    container.registerInstance(DatabaseClient, databaseClient);
    container.register(AutoFixSettingsService).inSingletonScope();
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

    const app = Fastify();
    app.addHook("onRequest", createAuthHook(container));
    await app.register(autoFixSettingsRoutes, { container });
    await app.register(autoFixPrRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db: databaseClient.db });

    return { app, databaseClient, enqueuedJobs, token };
}

describe("auto-fix routes", () => {
    let app: FastifyInstance;
    let databaseClient: TestDatabaseClient;
    let enqueuedJobs: JobWorker.CreateJobInput[];
    let token: string;

    beforeEach(async () => {
        const context = await createTestContext();
        app = context.app;
        databaseClient = context.databaseClient;
        enqueuedJobs = context.enqueuedJobs;
        token = context.token;
    });

    afterEach(async () => {
        await app.close();
    });

    describe("GET /api/auto-fix/:projectId/settings", () => {
        it("returns defaults when no settings exist", async () => {
            await insertTestProject(databaseClient, "proj-1");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/auto-fix/proj-1/settings"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body).toMatchObject({
                projectId: "proj-1",
                enabled: false,
                upgradeTypes: ["patch"],
                groupingStrategy: "per-package",
                branchPrefix: "auto-fix/"
            });
        });
    });

    describe("PUT /api/auto-fix/:projectId/settings", () => {
        it("creates settings on first update", async () => {
            await insertTestProject(databaseClient, "proj-1");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/auto-fix/proj-1/settings",
                payload: {
                    enabled: true,
                    upgradeTypes: ["patch", "minor"]
                }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body).toMatchObject({
                projectId: "proj-1",
                enabled: true,
                upgradeTypes: ["patch", "minor"],
                groupingStrategy: "per-package",
                branchPrefix: "auto-fix/"
            });
            expect(typeof body.id).toBe("string");
            expect(body.id).not.toBe("");
        });

        it("updates existing settings, preserving unspecified fields", async () => {
            await insertTestProject(databaseClient, "proj-1");
            await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/auto-fix/proj-1/settings",
                payload: { enabled: true, branchPrefix: "deps/" }
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: "/api/auto-fix/proj-1/settings",
                payload: { groupingStrategy: "per-project" }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.enabled).toBe(true);
            expect(body.branchPrefix).toBe("deps/");
            expect(body.groupingStrategy).toBe("per-project");
        });
    });

    describe("GET /api/auto-fix/pull-requests", () => {
        it("returns empty initially", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/auto-fix/pull-requests"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ items: [], total: 0 });
        });

        it("lists records and supports filtering by projectId and status", async () => {
            await insertTestProject(databaseClient, "proj-1");
            await insertTestProject(databaseClient, "proj-2");
            const now = Date.now();

            await databaseClient.db
                .insert(autoFixPullRequests)
                .values([
                    {
                        id: generateId(),
                        projectId: "proj-1",
                        packageNames: JSON.stringify(["lodash"]),
                        fromVersions: JSON.stringify({ lodash: "4.17.20" }),
                        toVersions: JSON.stringify({ lodash: "4.17.21" }),
                        upgradeType: "patch",
                        branchName: "auto-fix/lodash-4.17.21",
                        status: "pending",
                        licenseWarnings: null,
                        createdAt: now,
                        updatedAt: now
                    },
                    {
                        id: generateId(),
                        projectId: "proj-2",
                        packageNames: JSON.stringify(["react"]),
                        fromVersions: JSON.stringify({ react: "18.0.0" }),
                        toVersions: JSON.stringify({ react: "18.1.0" }),
                        upgradeType: "minor",
                        branchName: "auto-fix/react-18.1.0",
                        status: "created",
                        licenseWarnings: JSON.stringify(["react: license MIT flagged"]),
                        createdAt: now,
                        updatedAt: now
                    }
                ])
                .run();

            const allResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/auto-fix/pull-requests"
            });
            expect(allResponse.statusCode).toBe(200);
            const allBody = allResponse.json();
            expect(allBody.total).toBe(2);
            const reactItem = allBody.items.find(
                (item: { projectId: string }) => item.projectId === "proj-2"
            );
            expect(reactItem).toMatchObject({
                projectId: "proj-2",
                packageNames: ["react"],
                fromVersions: { react: "18.0.0" },
                toVersions: { react: "18.1.0" },
                status: "created",
                licenseWarnings: ["react: license MIT flagged"]
            });

            const filteredResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/auto-fix/pull-requests?projectId=proj-1&status=pending"
            });
            expect(filteredResponse.statusCode).toBe(200);
            const filteredBody = filteredResponse.json();
            expect(filteredBody.items).toHaveLength(1);
            expect(filteredBody.items[0]).toMatchObject({
                projectId: "proj-1",
                licenseWarnings: []
            });
        });
    });

    describe("GET /api/auto-fix/:projectId/pull-requests", () => {
        it("returns only records for the given project", async () => {
            await insertTestProject(databaseClient, "proj-1");
            await insertTestProject(databaseClient, "proj-2");
            const now = Date.now();

            await databaseClient.db
                .insert(autoFixPullRequests)
                .values([
                    {
                        id: generateId(),
                        projectId: "proj-1",
                        packageNames: JSON.stringify(["lodash"]),
                        fromVersions: JSON.stringify({ lodash: "4.17.20" }),
                        toVersions: JSON.stringify({ lodash: "4.17.21" }),
                        upgradeType: "patch",
                        branchName: "auto-fix/lodash-4.17.21",
                        status: "pending",
                        licenseWarnings: null,
                        createdAt: now,
                        updatedAt: now
                    },
                    {
                        id: generateId(),
                        projectId: "proj-2",
                        packageNames: JSON.stringify(["react"]),
                        fromVersions: JSON.stringify({ react: "18.0.0" }),
                        toVersions: JSON.stringify({ react: "18.1.0" }),
                        upgradeType: "minor",
                        branchName: "auto-fix/react-18.1.0",
                        status: "pending",
                        licenseWarnings: null,
                        createdAt: now,
                        updatedAt: now
                    }
                ])
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/auto-fix/proj-1/pull-requests"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.total).toBe(1);
            expect(body.items[0]).toMatchObject({ projectId: "proj-1" });
        });
    });

    describe("POST /api/auto-fix/:projectId/generate", () => {
        it("enqueues an auto-fix-pr job and returns its jobId", async () => {
            await insertTestProject(databaseClient, "proj-1");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/auto-fix/proj-1/generate"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ jobId: "stub-job-id" });
            expect(enqueuedJobs).toEqual([
                {
                    referenceId: "proj-1",
                    referenceType: "project",
                    type: "auto-fix-pr"
                }
            ]);
        });

        it("returns 404 when the project does not exist", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/auto-fix/missing-project/generate"
            });

            expect(response.statusCode).toBe(404);
            expect(enqueuedJobs).toHaveLength(0);
        });
    });

    describe("DELETE /api/auto-fix/pull-requests/:id", () => {
        it("removes the record", async () => {
            await insertTestProject(databaseClient, "proj-1");
            const id = generateId();
            const now = Date.now();
            await databaseClient.db
                .insert(autoFixPullRequests)
                .values({
                    id,
                    projectId: "proj-1",
                    packageNames: JSON.stringify(["lodash"]),
                    fromVersions: JSON.stringify({ lodash: "4.17.20" }),
                    toVersions: JSON.stringify({ lodash: "4.17.21" }),
                    upgradeType: "patch",
                    branchName: "auto-fix/lodash-4.17.21",
                    status: "pending",
                    licenseWarnings: null,
                    createdAt: now,
                    updatedAt: now
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "DELETE",
                url: `/api/auto-fix/pull-requests/${id}`
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ deleted: true });

            const listResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/auto-fix/pull-requests"
            });
            expect(listResponse.json()).toEqual({ items: [], total: 0 });
        });
    });
});
