import { describe, it, expect, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { LockfileParserService } from "#api/services/DependencyGraph/index.js";
import { DependencyGraphService } from "#api/services/DependencyGraphService.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { projects, dependencyEdges } from "#api/db/schema.js";
import { dependencyGraphRoutes } from "../dependencyGraph.js";

type TestDatabaseClient = Awaited<ReturnType<typeof createTestDatabaseClient>>;

interface IRouteTestContext {
    app: FastifyInstance;
    databaseClient: TestDatabaseClient;
    token: string;
}

async function insertTestProject(
    databaseClient: TestDatabaseClient,
    id: string,
    packageManager: string | null = "npm"
): Promise<void> {
    await databaseClient.db
        .insert(projects)
        .values({
            id,
            name: id,
            path: `/repo/${id}`,
            packageManager,
            addedAt: Date.now()
        })
        .run();
}

function createStubLockfileParserService(
    edges: LockfileParserService.DependencyEdge[]
): LockfileParserService.Interface {
    return {
        parse: async () => edges
    };
}

async function seedEdge(
    databaseClient: TestDatabaseClient,
    input: {
        projectId: string;
        parentPackage: string | null;
        parentVersion: string | null;
        childPackage: string;
        childVersion: string;
        depth: number;
    }
): Promise<void> {
    await databaseClient.db
        .insert(dependencyEdges)
        .values({
            id: generateId(),
            projectId: input.projectId,
            parentPackage: input.parentPackage,
            parentVersion: input.parentVersion,
            childPackage: input.childPackage,
            childVersion: input.childVersion,
            dependencyType: "dependency",
            depth: input.depth,
            scannedAt: Date.now()
        })
        .run();
}

async function createTestContext(
    parsedEdges: LockfileParserService.DependencyEdge[] = []
): Promise<IRouteTestContext> {
    const databaseClient = await createTestDatabaseClient();

    const container = createContainer();
    container.registerInstance(DatabaseClient, databaseClient);
    container.registerInstance(LockfileParserService, createStubLockfileParserService(parsedEdges));
    container.register(DependencyGraphService).inSingletonScope();
    container.registerInstance(EmailService, { send: vi.fn() });
    container.register(UserServiceRegistration).inSingletonScope();
    container.register(AuthServiceRegistration).inSingletonScope();

    const app = Fastify();
    app.addHook("onRequest", createAuthHook(container));
    await app.register(dependencyGraphRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db: databaseClient.db });

    return { app, databaseClient, token };
}

describe("dependency graph routes", () => {
    let app: FastifyInstance;
    let databaseClient: TestDatabaseClient;
    let token: string;

    afterEach(async () => {
        await app.close();
    });

    describe("GET /api/dependency-graph/:projectId", () => {
        it("returns an empty graph when none has been built", async () => {
            const context = await createTestContext();
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;
            await insertTestProject(databaseClient, "proj-1");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/dependency-graph/proj-1"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                edges: [],
                rootPackages: [],
                totalPackages: 0,
                maxDepth: 0,
                edgeCount: 0
            });
        });

        it("returns paths to a specific package when ?package= is provided", async () => {
            const context = await createTestContext();
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;
            await insertTestProject(databaseClient, "proj-1");

            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: "react",
                parentVersion: "18.0.0",
                childPackage: "loose-envify",
                childVersion: "1.4.0",
                depth: 1
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/dependency-graph/proj-1?package=loose-envify"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                paths: [
                    {
                        target: "loose-envify",
                        chain: [
                            { packageName: "react", version: "18.0.0" },
                            { packageName: "loose-envify", version: "1.4.0" }
                        ]
                    }
                ]
            });
        });
    });

    describe("GET /api/dependency-graph/:projectId/packages", () => {
        it("returns matching package names", async () => {
            const context = await createTestContext();
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;
            await insertTestProject(databaseClient, "proj-1");

            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash",
                childVersion: "4.17.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash.get",
                childVersion: "4.4.2",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: null,
                parentVersion: null,
                childPackage: "express",
                childVersion: "4.18.0",
                depth: 0
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/dependency-graph/proj-1/packages?query=lodash"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().packages.sort()).toEqual(["lodash", "lodash.get"]);
        });

        it("returns an empty array for an empty query", async () => {
            const context = await createTestContext();
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;
            await insertTestProject(databaseClient, "proj-1");

            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/dependency-graph/proj-1/packages"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ packages: [] });
        });
    });

    describe("POST /api/dependency-graph/:projectId/refresh", () => {
        it("parses the lockfile and returns the edge count", async () => {
            const context = await createTestContext([
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "react",
                    childVersion: "18.0.0",
                    dependencyType: "dependency",
                    depth: 0
                },
                {
                    parentPackage: "react",
                    parentVersion: "18.0.0",
                    childPackage: "loose-envify",
                    childVersion: "1.4.0",
                    dependencyType: "dependency",
                    depth: 1
                }
            ]);
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;
            await insertTestProject(databaseClient, "proj-1", "npm");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/dependency-graph/proj-1/refresh"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ edgeCount: 2 });

            const graphResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/dependency-graph/proj-1"
            });
            expect(graphResponse.json().edgeCount).toBe(2);
        });

        it("returns 404 when the project does not exist", async () => {
            const context = await createTestContext();
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/dependency-graph/missing-project/refresh"
            });

            expect(response.statusCode).toBe(404);
        });

        it("returns 400 when the project has no detected package manager", async () => {
            const context = await createTestContext();
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;
            await insertTestProject(databaseClient, "proj-1", null);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/dependency-graph/proj-1/refresh"
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe("GET /api/dependency-graph/:projectId/stats", () => {
        it("returns aggregated stats derived from the graph", async () => {
            const context = await createTestContext();
            app = context.app;
            databaseClient = context.databaseClient;
            token = context.token;
            await insertTestProject(databaseClient, "proj-1");

            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash",
                childVersion: "4.17.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId: "proj-1",
                parentPackage: "react",
                parentVersion: "18.0.0",
                childPackage: "loose-envify",
                childVersion: "1.4.0",
                depth: 1
            });

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/dependency-graph/proj-1/stats"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({
                totalPackages: 3,
                maxDepth: 1,
                rootCount: 2,
                edgeCount: 3
            });
        });
    });
});
