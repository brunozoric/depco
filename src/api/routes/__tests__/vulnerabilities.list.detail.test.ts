import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    createMockedRouteContext,
    makeVulnerabilityDetail,
    makeOsvEnrichedDetail,
    type IMockedRouteContext
} from "./vulnerabilities.testHelpers.js";

// This file covers GET /api/vulnerabilities/:vulnerabilityId/detail. List,
// summary, and per-project routes live in vulnerabilities.list.core.test.ts;
// dependencyType filtering lives in
// vulnerabilities.list.dependencyType.test.ts.
describe("vulnerability routes - single vulnerability detail", () => {
    let ctx: IMockedRouteContext;

    beforeEach(async () => {
        ctx = await createMockedRouteContext();
    });

    afterEach(async () => {
        await ctx.app.close();
    });

    describe("GET /api/vulnerabilities/:vulnerabilityId/detail", () => {
        it("returns the vulnerability with a null osvDetail when there is no cveId", async () => {
            const detail = makeVulnerabilityDetail({ cveId: null, dependencyKind: "transitive" });
            vi.mocked(ctx.vulnerabilityService.getById).mockResolvedValue(detail);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/some-id/detail"
            });

            expect(response.statusCode).toBe(200);
            expect(ctx.vulnerabilityService.getById).toHaveBeenCalledWith("some-id");
            expect(ctx.osvCacheService.getEnrichedDetail).not.toHaveBeenCalled();
            const body = response.json();
            expect(body).toMatchObject({ vulnerability: detail, osvDetail: null });
            expect(body.vulnerability.dependencyKind).toBe("transitive");
        });

        it("enriches the vulnerability with OSV detail when a cveId is present", async () => {
            const detail = makeVulnerabilityDetail({
                cveId: "CVE-2021-0001",
                dependencyKind: "transitive"
            });
            const enriched = makeOsvEnrichedDetail();
            vi.mocked(ctx.vulnerabilityService.getById).mockResolvedValue(detail);
            vi.mocked(ctx.osvCacheService.getEnrichedDetail).mockResolvedValue(enriched);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/some-id/detail"
            });

            expect(response.statusCode).toBe(200);
            expect(ctx.osvCacheService.getEnrichedDetail).toHaveBeenCalledWith("CVE-2021-0001");
            const body = response.json();
            expect(body).toMatchObject({ vulnerability: detail, osvDetail: enriched });
            expect(body.vulnerability.dependencyKind).toBe("transitive");
        });

        it("returns 404 when the vulnerability does not exist", async () => {
            vi.mocked(ctx.vulnerabilityService.getById).mockResolvedValue(null);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/missing-id/detail"
            });

            expect(response.statusCode).toBe(404);
            expect(response.json()).toEqual({
                error: { code: "UNKNOWN", message: "Vulnerability not found" }
            });
        });

        it("is not shadowed by the /:projectId route", async () => {
            const detail = makeVulnerabilityDetail({ cveId: null });
            vi.mocked(ctx.vulnerabilityService.getById).mockResolvedValue(detail);
            vi.mocked(ctx.vulnerabilityService.getLatest).mockResolvedValue([]);

            const response = await ctx.app.inject({
                headers: { authorization: `Bearer ${ctx.token}` },
                method: "GET",
                url: "/api/vulnerabilities/some-id/detail"
            });

            expect(response.statusCode).toBe(200);
            expect(ctx.vulnerabilityService.getLatest).not.toHaveBeenCalled();
            expect(response.json()).toMatchObject({ vulnerability: { id: detail.id } });
        });
    });
});
