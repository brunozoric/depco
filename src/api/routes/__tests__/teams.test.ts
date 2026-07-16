import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import {
    projects,
    teamProjects,
    vulnerabilities,
    healthSnapshots,
    licenseSnapshots
} from "#api/db/schema.js";
import { teamsRoutes } from "../teams.js";

type TestDb = DatabaseClient.Interface["db"];

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

describe("teams routes", () => {
    let app: FastifyInstance;
    let db: TestDb;

    beforeEach(async () => {
        const databaseClient = await createTestDatabaseClient();
        db = databaseClient.db;

        const container = createContainer();
        container.registerInstance(DatabaseClient, databaseClient);

        app = Fastify();
        await app.register(teamsRoutes, { container });
        await app.ready();
    });

    afterEach(async () => {
        await app.close();
    });

    it("POST /api/teams creates a team with zero stats", async () => {
        const response = await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });

        expect(response.statusCode).toBe(201);
        const body = response.json();
        expect(body.item).toMatchObject({
            name: "Platform",
            color: "#ff0000",
            projectCount: 0,
            vulnerabilityCount: 0,
            compliantPercent: 100,
            averageHealthScore: 0
        });
        expect(typeof body.item.id).toBe("string");
        expect(typeof body.item.createdAt).toBe("number");
    });

    it("GET /api/teams returns created teams", async () => {
        await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });
        await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Growth", color: "#00ff00" }
        });

        const response = await app.inject({ method: "GET", url: "/api/teams" });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.total).toBe(2);
        expect(body.items.map((item: { name: string }) => item.name).sort()).toEqual([
            "Growth",
            "Platform"
        ]);
    });

    it("POST /api/teams with duplicate name returns 409", async () => {
        await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#00ff00" }
        });

        expect(response.statusCode).toBe(409);
    });

    it("PUT /api/teams/:id updates name and color", async () => {
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });
        const created = createResponse.json().item;

        const updateResponse = await app.inject({
            method: "PUT",
            url: `/api/teams/${created.id}`,
            payload: { name: "Platform Team", color: "#0000ff" }
        });

        expect(updateResponse.statusCode).toBe(200);
        const updated = updateResponse.json().item;
        expect(updated.id).toBe(created.id);
        expect(updated.name).toBe("Platform Team");
        expect(updated.color).toBe("#0000ff");
    });

    it("PUT /api/teams/:id returns 409 when renaming to another team's name", async () => {
        await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });
        const growthResponse = await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Growth", color: "#00ff00" }
        });
        const growth = growthResponse.json().item;

        const response = await app.inject({
            method: "PUT",
            url: `/api/teams/${growth.id}`,
            payload: { name: "Platform" }
        });

        expect(response.statusCode).toBe(409);
    });

    it("PUT /api/teams/:id returns 404 when team does not exist", async () => {
        const response = await app.inject({
            method: "PUT",
            url: `/api/teams/${generateId()}`,
            payload: { name: "Ghost Team" }
        });

        expect(response.statusCode).toBe(404);
    });

    it("DELETE /api/teams/:id removes the team and cascades team_projects", async () => {
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });
        const created = createResponse.json().item;

        await insertTestProject(db, "proj-1");
        await db
            .insert(teamProjects)
            .values({ id: generateId(), teamId: created.id, projectId: "proj-1" })
            .run();

        const deleteResponse = await app.inject({
            method: "DELETE",
            url: `/api/teams/${created.id}`
        });

        expect(deleteResponse.statusCode).toBe(204);

        const remainingTeamProjects = await db
            .select()
            .from(teamProjects)
            .where(eq(teamProjects.teamId, created.id))
            .all();
        expect(remainingTeamProjects).toHaveLength(0);
    });

    it("DELETE /api/teams/:id returns 404 when team does not exist", async () => {
        const response = await app.inject({
            method: "DELETE",
            url: `/api/teams/${generateId()}`
        });

        expect(response.statusCode).toBe(404);
    });

    it("GET /api/teams/:id returns team detail with project list", async () => {
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });
        const created = createResponse.json().item;

        await insertTestProject(db, "proj-1", "app-one");
        await insertTestProject(db, "proj-2", "app-two");
        await db
            .insert(teamProjects)
            .values([
                { id: generateId(), teamId: created.id, projectId: "proj-1" },
                { id: generateId(), teamId: created.id, projectId: "proj-2" }
            ])
            .run();

        const response = await app.inject({ method: "GET", url: `/api/teams/${created.id}` });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.id).toBe(created.id);
        expect(body.item.projects.map((project: { name: string }) => project.name).sort()).toEqual([
            "app-one",
            "app-two"
        ]);
        expect(body.item.projects[0]).toHaveProperty("path");
    });

    it("GET /api/teams/:id returns 404 when team does not exist", async () => {
        const response = await app.inject({
            method: "GET",
            url: `/api/teams/${generateId()}`
        });

        expect(response.statusCode).toBe(404);
    });

    it("GET /api/teams computes aggregate stats across a team's projects", async () => {
        const createResponse = await app.inject({
            method: "POST",
            url: "/api/teams",
            payload: { name: "Platform", color: "#ff0000" }
        });
        const created = createResponse.json().item;

        await insertTestProject(db, "proj-1", "app-one");
        await insertTestProject(db, "proj-2", "app-two");
        await db
            .insert(teamProjects)
            .values([
                { id: generateId(), teamId: created.id, projectId: "proj-1" },
                { id: generateId(), teamId: created.id, projectId: "proj-2" }
            ])
            .run();

        const now = Date.now();

        // Vulnerabilities: proj-1 has two active vulnerabilities and one
        // permanently dismissed vulnerability that must not be counted.
        // proj-2 has one vulnerability whose snooze window already elapsed
        // (counts as active) and one still-snoozed vulnerability that must
        // not be counted.
        await db
            .insert(vulnerabilities)
            .values([
                {
                    id: generateId(),
                    projectId: "proj-1",
                    packageName: "left-pad",
                    severity: "high",
                    title: "Vuln A",
                    dedupKey: "dedup-a",
                    source: "audit",
                    scannedAt: now,
                    dismissedAt: null,
                    dismissedUntil: null,
                    dismissedBy: null
                },
                {
                    id: generateId(),
                    projectId: "proj-1",
                    packageName: "right-pad",
                    severity: "moderate",
                    title: "Vuln B",
                    dedupKey: "dedup-b",
                    source: "audit",
                    scannedAt: now,
                    dismissedAt: null,
                    dismissedUntil: null,
                    dismissedBy: null
                },
                {
                    id: generateId(),
                    projectId: "proj-1",
                    packageName: "top-pad",
                    severity: "low",
                    title: "Vuln C (dismissed)",
                    dedupKey: "dedup-c",
                    source: "audit",
                    scannedAt: now,
                    dismissedAt: now,
                    dismissedUntil: null,
                    dismissedBy: "user"
                },
                {
                    id: generateId(),
                    projectId: "proj-2",
                    packageName: "bottom-pad",
                    severity: "critical",
                    title: "Vuln D (snooze expired)",
                    dedupKey: "dedup-d",
                    source: "audit",
                    scannedAt: now,
                    dismissedAt: now - 100000,
                    dismissedUntil: now - 1000,
                    dismissedBy: "user"
                },
                {
                    id: generateId(),
                    projectId: "proj-2",
                    packageName: "side-pad",
                    severity: "critical",
                    title: "Vuln E (still snoozed)",
                    dedupKey: "dedup-e",
                    source: "audit",
                    scannedAt: now,
                    dismissedAt: now,
                    dismissedUntil: now + 1000000,
                    dismissedBy: "user"
                }
            ])
            .run();

        // Health snapshots: proj-1's latest score is 90 (later date wins over
        // the earlier 80), proj-2 has a single snapshot at 60.
        // Average = (90 + 60) / 2 = 75.
        await db
            .insert(healthSnapshots)
            .values([
                {
                    id: generateId(),
                    projectId: "proj-1",
                    date: "2026-08-01",
                    score: 80,
                    totalPackages: 10,
                    upToDate: 8,
                    patchOutdated: 1,
                    minorOutdated: 1,
                    majorOutdated: 0,
                    scannedAt: now
                },
                {
                    id: generateId(),
                    projectId: "proj-1",
                    date: "2026-08-02",
                    score: 90,
                    totalPackages: 10,
                    upToDate: 9,
                    patchOutdated: 1,
                    minorOutdated: 0,
                    majorOutdated: 0,
                    scannedAt: now
                },
                {
                    id: generateId(),
                    projectId: "proj-2",
                    date: "2026-08-01",
                    score: 60,
                    totalPackages: 10,
                    upToDate: 6,
                    patchOutdated: 2,
                    minorOutdated: 2,
                    majorOutdated: 0,
                    scannedAt: now
                }
            ])
            .run();

        // License snapshots: proj-1's latest is 90% compliant (9/10, later
        // date wins over the earlier 80%), proj-2 is 50% compliant (5/10).
        // Average = (90 + 50) / 2 = 70.
        await db
            .insert(licenseSnapshots)
            .values([
                {
                    id: generateId(),
                    projectId: "proj-1",
                    date: "2026-08-01",
                    totalPackages: 10,
                    compliantCount: 8,
                    deniedCount: 2,
                    warnedCount: 0,
                    scannedAt: now
                },
                {
                    id: generateId(),
                    projectId: "proj-1",
                    date: "2026-08-02",
                    totalPackages: 10,
                    compliantCount: 9,
                    deniedCount: 1,
                    warnedCount: 0,
                    scannedAt: now
                },
                {
                    id: generateId(),
                    projectId: "proj-2",
                    date: "2026-08-01",
                    totalPackages: 10,
                    compliantCount: 5,
                    deniedCount: 5,
                    warnedCount: 0,
                    scannedAt: now
                }
            ])
            .run();

        const response = await app.inject({ method: "GET", url: "/api/teams" });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        const team = body.items.find((item: { id: string }) => item.id === created.id);

        expect(team).toMatchObject({
            projectCount: 2,
            vulnerabilityCount: 3,
            compliantPercent: 70,
            averageHealthScore: 75
        });
    });
});
