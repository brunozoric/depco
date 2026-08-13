import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import type { IVulnerabilitySummary } from "#api/services/Vulnerability/index.js";
import { vulnerabilities, teams, teamProjects } from "#api/db/schema.js";
import {
    createMockedRouteContext,
    createTestContext,
    insertTestProject,
    seedVulnerabilities,
    makeVulnerability,
    makeEnrichedVulnerability,
    type IMockedRouteContext
} from "./vulnerabilities.testHelpers.js";

// This file covers GET /api/vulnerabilities (list + team filtering), GET
// /api/vulnerabilities/summary, and GET /api/vulnerabilities/:projectId
// (including sorting/pagination). The single-vulnerability detail route
// lives in vulnerabilities.list.detail.test.ts and dependencyType filtering
// lives in vulnerabilities.list.dependencyType.test.ts.
describe("vulnerability routes - list, summary, and per-project", () => {
    let ctx: IMockedRouteContext;

    beforeEach(async () => {
        ctx = await createMockedRouteContext();
    });

    afterEach(async () => {
        await ctx.app.close();
    });

    describe("GET /api/vulnerabilities", () => {
        it("lists all vulnerabilities across projects, enriched with projectName", async () => {
            const items = [makeVulnerability(), makeVulnerability({ id: generateId() })];
            vi.mocked(ctx.vulnerabilityService.getAll).mockResolvedValue(items);
            vi.mocked(ctx.vulnerabilityService.enrichAndSort).mockResolvedValue({
                items: items.map(item =>
                    makeEnrichedVulnerability({ item, projectName: "my-app" })
                ),
                total: items.length
            });

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(2);
            expect(body.items[0].projectName).toBe("my-app");
            expect(body.items[1].projectName).toBe("my-app");
            expect(ctx.vulnerabilityService.getAll).toHaveBeenCalledWith({});
        });

        it("falls back to 'Unknown' when the project no longer exists", async () => {
            const items = [makeVulnerability({ projectId: "missing-project" })];
            vi.mocked(ctx.vulnerabilityService.getAll).mockResolvedValue(items);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items[0].projectName).toBe("Unknown");
        });

        it("passes severity/packageName/source filters through to getAll", async () => {
            vi.mocked(ctx.vulnerabilityService.getAll).mockResolvedValue([]);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities?severity=critical&packageName=lodash&source=osv"
            });

            expect(response.statusCode).toBe(200);
            expect(ctx.vulnerabilityService.getAll).toHaveBeenCalledWith({
                severity: "critical",
                packageName: "lodash",
                source: "osv"
            });
        });

        it("resolves teamId to projectIds and passes them through to getAll", async () => {
            await insertTestProject(ctx.db, "proj-a");
            await insertTestProject(ctx.db, "proj-b");
            await insertTestProject(ctx.db, "proj-c");
            const teamId = generateId();
            await ctx.db
                .insert(teams)
                .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
                .run();
            await ctx.db
                .insert(teamProjects)
                .values([
                    { id: generateId(), teamId, projectId: "proj-a" },
                    { id: generateId(), teamId, projectId: "proj-b" }
                ])
                .run();
            vi.mocked(ctx.vulnerabilityService.getAll).mockResolvedValue([]);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}`
            });

            expect(response.statusCode).toBe(200);
            expect(ctx.vulnerabilityService.getAll).toHaveBeenCalledWith({
                projectIds: expect.arrayContaining(["proj-a", "proj-b"])
            });
            const call = vi.mocked(ctx.vulnerabilityService.getAll).mock.calls[0]?.[0];
            expect(call?.projectIds).toHaveLength(2);
        });

        it("intersects teamId-resolved projectIds with an explicit projectIds filter", async () => {
            await insertTestProject(ctx.db, "proj-a");
            await insertTestProject(ctx.db, "proj-b");
            await insertTestProject(ctx.db, "proj-c");
            const teamId = generateId();
            await ctx.db
                .insert(teams)
                .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
                .run();
            await ctx.db
                .insert(teamProjects)
                .values([
                    { id: generateId(), teamId, projectId: "proj-a" },
                    { id: generateId(), teamId, projectId: "proj-b" }
                ])
                .run();
            vi.mocked(ctx.vulnerabilityService.getAll).mockResolvedValue([]);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}&projectIds=proj-b,proj-c`
            });

            expect(response.statusCode).toBe(200);
            expect(ctx.vulnerabilityService.getAll).toHaveBeenCalledWith({
                projectIds: ["proj-b"]
            });
        });

        it("returns an empty list without calling getAll when teamId has no projects", async () => {
            const teamId = generateId();
            await ctx.db
                .insert(teams)
                .values({ id: teamId, name: "Empty Team", color: "#ff0000", createdAt: Date.now() })
                .run();

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
            expect(ctx.vulnerabilityService.getAll).not.toHaveBeenCalled();
        });

        it("returns an empty list without calling getAll when teamId/projectIds intersection is empty", async () => {
            await insertTestProject(ctx.db, "proj-a");
            await insertTestProject(ctx.db, "proj-b");
            const teamId = generateId();
            await ctx.db
                .insert(teams)
                .values({ id: teamId, name: "Platform", color: "#ff0000", createdAt: Date.now() })
                .run();
            await ctx.db
                .insert(teamProjects)
                .values({ id: generateId(), teamId, projectId: "proj-a" })
                .run();

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: `/api/vulnerabilities?teamId=${teamId}&projectIds=proj-b`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toEqual([]);
            expect(body.total).toBe(0);
            expect(ctx.vulnerabilityService.getAll).not.toHaveBeenCalled();
        });
    });

    describe("GET /api/vulnerabilities/summary", () => {
        it("returns counts and project summaries", async () => {
            const summary: IVulnerabilitySummary = {
                totalVulnerabilities: 3,
                counts: { critical: 1, high: 1, moderate: 1, low: 0, info: 0 },
                transitiveCount: 1,
                directCount: 2,
                projectSummaries: [
                    {
                        projectId: "proj-1",
                        projectName: "app",
                        total: 3,
                        critical: 1,
                        high: 1,
                        moderate: 1,
                        low: 0
                    }
                ]
            };
            vi.mocked(ctx.vulnerabilityService.getSummary).mockResolvedValue(summary);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.totalVulnerabilities).toBe(3);
            expect(body.counts.critical).toBe(1);
            expect(body.projectSummaries).toHaveLength(1);
            expect(ctx.vulnerabilityService.getSummary).toHaveBeenCalled();
        });

        it("includes transitiveCount and directCount fields in the response", async () => {
            const summary: IVulnerabilitySummary = {
                totalVulnerabilities: 5,
                counts: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 },
                transitiveCount: 2,
                directCount: 3,
                projectSummaries: []
            };
            vi.mocked(ctx.vulnerabilityService.getSummary).mockResolvedValue(summary);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.transitiveCount).toBe(2);
            expect(body.directCount).toBe(3);
        });

        it("returns transitiveCount and directCount that match mixed dependencyKind vulnerabilities", async () => {
            const summary: IVulnerabilitySummary = {
                totalVulnerabilities: 4,
                counts: { critical: 1, high: 1, moderate: 1, low: 1, info: 0 },
                transitiveCount: 3,
                directCount: 1,
                projectSummaries: [
                    {
                        projectId: "proj-1",
                        projectName: "app",
                        total: 4,
                        critical: 1,
                        high: 1,
                        moderate: 1,
                        low: 1
                    }
                ]
            };
            vi.mocked(ctx.vulnerabilityService.getSummary).mockResolvedValue(summary);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/summary"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.transitiveCount).toBe(3);
            expect(body.directCount).toBe(1);
            expect(body.transitiveCount + body.directCount).toBe(body.totalVulnerabilities);
        });
    });

    describe("GET /api/vulnerabilities/:projectId", () => {
        it("lists vulnerabilities for a specific project, enriched with projectName", async () => {
            const items = [makeVulnerability({ projectId: "proj-1" })];
            vi.mocked(ctx.vulnerabilityService.getLatest).mockResolvedValue(items);
            vi.mocked(ctx.vulnerabilityService.enrichAndSort).mockResolvedValue({
                items: items.map(item =>
                    makeEnrichedVulnerability({ item, projectName: "my-app" })
                ),
                total: items.length
            });

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/proj-1"
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.items).toHaveLength(1);
            expect(body.total).toBe(1);
            expect(body.items[0].projectName).toBe("my-app");
            expect(ctx.vulnerabilityService.getLatest).toHaveBeenCalledWith("proj-1", {});
        });

        it("applies filters when listing project vulnerabilities", async () => {
            vi.mocked(ctx.vulnerabilityService.getLatest).mockResolvedValue([]);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/proj-1?severity=low&source=both"
            });

            expect(response.statusCode).toBe(200);
            expect(ctx.vulnerabilityService.getLatest).toHaveBeenCalledWith("proj-1", {
                severity: "low",
                source: "both"
            });
        });
    });

    describe("GET /api/vulnerabilities/:projectId (sorting and pagination)", () => {
        it("returns paginated results when page and pageSize are provided", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            await seedVulnerabilities(db, 5, "proj-page");

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: "/api/vulnerabilities/proj-page?page=1&pageSize=2"
            });

            expect(response.statusCode).toBe(200);
            const body = JSON.parse(response.body);
            expect(body.items).toHaveLength(2);
            expect(body.total).toBe(5);

            await testApp.close();
        });

        it("sorts by packageName ascending", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const projectId = "proj-sort";
            await insertTestProject(db, projectId);
            await db.insert(vulnerabilities).values([
                {
                    id: "v-z",
                    projectId,
                    packageName: "zlib",
                    severity: "low",
                    title: "Issue Z",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "z-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                },
                {
                    id: "v-a",
                    projectId,
                    packageName: "axios",
                    severity: "high",
                    title: "Issue A",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "a-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                }
            ]);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: `/api/vulnerabilities/${projectId}?sortBy=packageName&sortOrder=asc`
            });

            const body = JSON.parse(response.body);
            expect(body.items[0].packageName).toBe("axios");
            expect(body.items[1].packageName).toBe("zlib");

            await testApp.close();
        });

        it("defaults to severity desc when no sort params provided", async () => {
            const { app: testApp, db, token: testToken } = await createTestContext();
            const projectId = "proj-default-sort";
            await insertTestProject(db, projectId);
            await db.insert(vulnerabilities).values([
                {
                    id: "v-low",
                    projectId,
                    packageName: "low-pkg",
                    severity: "low",
                    title: "Low issue",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "low-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                },
                {
                    id: "v-crit",
                    projectId,
                    packageName: "crit-pkg",
                    severity: "critical",
                    title: "Critical issue",
                    advisoryUrl: null,
                    cveId: null,
                    dedupKey: "crit-key",
                    vulnerableRange: null,
                    fixVersion: null,
                    source: "audit",
                    scannedAt: Date.now()
                }
            ]);

            const response = await testApp.inject({
                headers: { authorization: `Bearer ${testToken}` },
                method: "GET",
                url: `/api/vulnerabilities/${projectId}`
            });

            const body = JSON.parse(response.body);
            expect(body.items[0].severity).toBe("critical");
            expect(body.items[1].severity).toBe("low");

            await testApp.close();
        });
    });
});
