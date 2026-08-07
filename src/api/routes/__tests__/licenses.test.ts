import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "../../services/abstractions/JobWorker.js";
import { EmailService } from "../../services/abstractions/EmailService.js";
import { UserService as UserServiceRegistration } from "../../services/UserService.js";
import { AuthService as AuthServiceRegistration } from "../../services/AuthService.js";
import { createAuthHook } from "../../middleware/authHook.js";
import {
    projects,
    licenses,
    licensePolicyRules,
    licenseViolations,
    teams,
    teamProjects
} from "#api/db/schema.js";
import { licenseRoutes } from "../licenses.js";
import { licensePolicyRoutes } from "../licensePolicies.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

interface IRouteTestContext {
    app: FastifyInstance;
    db: TestDb;
    enqueuedJobs: JobWorker.CreateJobInput[];
    token: string;
}

async function insertTestProject(db: TestDb, id: string, name = id): Promise<void> {
    await db
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
 * Wires both the license data routes and the license policy CRUD routes onto
 * a single Fastify instance against a real in-memory SQLite database. Only
 * JobWorker is mocked, so the license-scan route can be asserted against
 * without exercising the full job pipeline.
 */
async function createTestContext(): Promise<IRouteTestContext> {
    const db = await createTestDb();
    const enqueuedJobs: JobWorker.CreateJobInput[] = [];

    const container = createContainer();
    container.registerInstance(DatabaseClient, { db });
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
    await app.register(licenseRoutes, { container });
    await app.register(licensePolicyRoutes, { container });
    await app.ready();

    const { token } = await createTestSession({ db });

    return { app, db, enqueuedJobs, token };
}

describe("license routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let enqueuedJobs: JobWorker.CreateJobInput[];
    let token: string;

    beforeEach(async () => {
        const context = await createTestContext();
        app = context.app;
        db = context.db;
        enqueuedJobs = context.enqueuedJobs;
        token = context.token;
    });

    afterEach(async () => {
        await app.close();
    });

    it("GET /api/licenses returns empty initially", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/licenses"
        });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ items: [], total: 0 });
    });

    it("GET /api/licenses?teamId filters to only the team's assigned projects", async () => {
        await insertTestProject(db, "proj-a", "app-a");
        await insertTestProject(db, "proj-b", "app-b");
        await insertTestProject(db, "proj-c", "app-c");

        const teamId = generateId();
        await db
            .insert(teams)
            .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
            .run();
        await db
            .insert(teamProjects)
            .values([
                { id: generateId(), teamId, projectId: "proj-a" },
                { id: generateId(), teamId, projectId: "proj-b" }
            ])
            .run();

        await db
            .insert(licenses)
            .values([
                {
                    id: generateId(),
                    projectId: "proj-a",
                    packageName: "left-pad",
                    licenseName: "MIT",
                    spdxId: "MIT",
                    source: "registry",
                    riskTier: "permissive",
                    scannedAt: Date.now()
                },
                {
                    id: generateId(),
                    projectId: "proj-b",
                    packageName: "right-pad",
                    licenseName: "MIT",
                    spdxId: "MIT",
                    source: "registry",
                    riskTier: "permissive",
                    scannedAt: Date.now()
                },
                {
                    id: generateId(),
                    projectId: "proj-c",
                    packageName: "top-pad",
                    licenseName: "MIT",
                    spdxId: "MIT",
                    source: "registry",
                    riskTier: "permissive",
                    scannedAt: Date.now()
                }
            ])
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/licenses?teamId=${teamId}`
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.total).toBe(2);
        expect(body.items.map((item: { packageName: string }) => item.packageName).sort()).toEqual([
            "left-pad",
            "right-pad"
        ]);
    });

    describe("license policy CRUD", () => {
        it("POST /api/license-policies creates a rule, GET returns it", async () => {
            const createResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/license-policies",
                payload: {
                    action: "deny",
                    licensePattern: "GPL-*",
                    packagePattern: null,
                    projectId: null,
                    priority: 10,
                    reason: "Copyleft not allowed"
                }
            });

            expect(createResponse.statusCode).toBe(201);
            const created = createResponse.json();
            expect(created).toMatchObject({
                action: "deny",
                licensePattern: "GPL-*",
                packagePattern: null,
                projectId: null,
                priority: 10,
                reason: "Copyleft not allowed"
            });
            expect(typeof created.id).toBe("string");
            expect(typeof created.createdAt).toBe("number");
            expect(typeof created.updatedAt).toBe("number");

            const listResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/license-policies"
            });

            expect(listResponse.statusCode).toBe(200);
            const body = listResponse.json();
            expect(body.items).toHaveLength(1);
            expect(body.items[0]).toMatchObject({ id: created.id, action: "deny" });
        });

        it("GET /api/license-policies filters by projectId", async () => {
            await insertTestProject(db, "proj-1");
            await db
                .insert(licensePolicyRules)
                .values([
                    {
                        id: generateId(),
                        action: "allow",
                        licensePattern: "MIT",
                        packagePattern: null,
                        projectId: null,
                        priority: 0,
                        reason: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        action: "warn",
                        licensePattern: "LGPL-*",
                        packagePattern: null,
                        projectId: "proj-1",
                        priority: 5,
                        reason: null,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/license-policies?projectId=proj-1"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(1);
            expect(body.items[0].projectId).toBe("proj-1");
        });

        it("PUT /api/license-policies/:id updates a rule", async () => {
            const createResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/license-policies",
                payload: {
                    action: "warn",
                    licensePattern: "MPL-*",
                    priority: 3
                }
            });
            const created = createResponse.json();

            const updateResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: `/api/license-policies/${created.id}`,
                payload: {
                    action: "deny",
                    reason: "Escalated after review"
                }
            });

            expect(updateResponse.statusCode).toBe(200);
            const updated = updateResponse.json();
            expect(updated.id).toBe(created.id);
            expect(updated.action).toBe("deny");
            expect(updated.reason).toBe("Escalated after review");
            // Fields not included in the PUT body are preserved unchanged.
            expect(updated.licensePattern).toBe("MPL-*");
            expect(updated.priority).toBe(3);
            expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
        });

        it("PUT /api/license-policies/:id returns 404 when rule does not exist", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "PUT",
                url: `/api/license-policies/${generateId()}`,
                payload: { action: "warn" }
            });

            expect(response.statusCode).toBe(404);
        });

        it("DELETE /api/license-policies/:id removes the rule and its violations", async () => {
            await insertTestProject(db, "proj-1");

            const ruleId = generateId();
            await db
                .insert(licensePolicyRules)
                .values({
                    id: ruleId,
                    action: "deny",
                    licensePattern: "GPL-*",
                    packagePattern: null,
                    projectId: null,
                    priority: 10,
                    reason: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                })
                .run();

            const licenseId = generateId();
            await db
                .insert(licenses)
                .values({
                    id: licenseId,
                    projectId: "proj-1",
                    packageName: "some-gpl-lib",
                    licenseName: "GPL-3.0",
                    spdxId: "GPL-3.0",
                    source: "license-checker",
                    riskTier: "copyleft",
                    licenseUrl: null,
                    scannedAt: Date.now()
                })
                .run();

            await db
                .insert(licenseViolations)
                .values({
                    id: generateId(),
                    licenseId,
                    ruleId,
                    projectId: "proj-1",
                    packageName: "some-gpl-lib",
                    action: "deny",
                    scannedAt: Date.now()
                })
                .run();

            const deleteResponse = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "DELETE",
                url: `/api/license-policies/${ruleId}`
            });

            expect(deleteResponse.statusCode).toBe(200);
            expect(deleteResponse.json()).toEqual({ deleted: true });

            const remainingRule = await db
                .select()
                .from(licensePolicyRules)
                .where(eq(licensePolicyRules.id, ruleId))
                .get();
            expect(remainingRule).toBeUndefined();

            const remainingViolations = await db
                .select()
                .from(licenseViolations)
                .where(eq(licenseViolations.ruleId, ruleId))
                .all();
            expect(remainingViolations).toHaveLength(0);
        });
    });

    describe("GET /api/licenses/summary", () => {
        it("returns correct aggregates across projects", async () => {
            await insertTestProject(db, "proj-1", "app-one");
            await insertTestProject(db, "proj-2", "app-two");

            const licenseIds = Array.from({ length: 3 }, () => generateId());
            await db
                .insert(licenses)
                .values([
                    {
                        id: licenseIds[0]!,
                        projectId: "proj-1",
                        packageName: "left-pad",
                        licenseName: "MIT",
                        spdxId: "MIT",
                        source: "registry",
                        riskTier: "permissive",
                        licenseUrl: null,
                        scannedAt: Date.now()
                    },
                    {
                        id: licenseIds[1]!,
                        projectId: "proj-1",
                        packageName: "gpl-thing",
                        licenseName: "GPL-3.0",
                        spdxId: "GPL-3.0",
                        source: "license-checker",
                        riskTier: "copyleft",
                        licenseUrl: null,
                        scannedAt: Date.now()
                    },
                    {
                        id: licenseIds[2]!,
                        projectId: "proj-2",
                        packageName: "lgpl-thing",
                        licenseName: "LGPL-3.0",
                        spdxId: "LGPL-3.0",
                        source: "license-checker",
                        riskTier: "weak-copyleft",
                        licenseUrl: null,
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const ruleId = generateId();
            await db
                .insert(licensePolicyRules)
                .values({
                    id: ruleId,
                    action: "deny",
                    licensePattern: "GPL-*",
                    packagePattern: null,
                    projectId: null,
                    priority: 10,
                    reason: null,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                })
                .run();

            await db
                .insert(licenseViolations)
                .values([
                    {
                        id: generateId(),
                        licenseId: licenseIds[1]!,
                        ruleId,
                        projectId: "proj-1",
                        packageName: "gpl-thing",
                        action: "deny",
                        scannedAt: Date.now()
                    },
                    {
                        id: generateId(),
                        licenseId: licenseIds[2]!,
                        ruleId,
                        projectId: "proj-2",
                        packageName: "lgpl-thing",
                        action: "warn",
                        scannedAt: Date.now()
                    }
                ])
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "GET",
                url: "/api/licenses/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();

            expect(body.totalPackages).toBe(3);
            // One of three packages is denied -> (3 - 1) / 3 = 66.67% -> rounds to 67.
            expect(body.compliantPercent).toBe(67);
            expect(body.riskTierCounts).toEqual({
                permissive: 1,
                "weak-copyleft": 1,
                copyleft: 1,
                proprietary: 0,
                unknown: 0
            });
            expect(body.violationCounts).toEqual({ warn: 1, deny: 1 });

            const projectOne = body.projectSummaries.find(
                (summary: { projectId: string }) => summary.projectId === "proj-1"
            );
            const projectTwo = body.projectSummaries.find(
                (summary: { projectId: string }) => summary.projectId === "proj-2"
            );
            expect(projectOne).toMatchObject({
                projectId: "proj-1",
                projectName: "app-one",
                total: 2,
                denied: 1,
                warned: 0
            });
            expect(projectTwo).toMatchObject({
                projectId: "proj-2",
                projectName: "app-two",
                total: 1,
                denied: 0,
                warned: 1
            });
        });
    });

    describe("POST /api/licenses/:projectId/scan", () => {
        it("enqueues a scan job and returns its jobId", async () => {
            await insertTestProject(db, "proj-1");

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/licenses/proj-1/scan"
            });

            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ jobId: "stub-job-id" });
            expect(enqueuedJobs).toEqual([
                {
                    referenceId: "proj-1",
                    referenceType: "project",
                    type: "scan"
                }
            ]);
        });

        it("returns 404 when the project does not exist", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/licenses/missing-project/scan"
            });

            expect(response.statusCode).toBe(404);
            expect(enqueuedJobs).toHaveLength(0);
        });
    });
});
