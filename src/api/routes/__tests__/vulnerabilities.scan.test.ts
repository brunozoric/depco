import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { VulnerabilityService } from "#api/services/Vulnerability/index.js";
import type { IVulnerabilityScanResult } from "#api/services/Vulnerability/index.js";
import { OsvCacheService } from "#api/services/Vulnerability/index.js";
import { projects } from "#api/db/schema.js";
import { vulnerabilityRoutes } from "../vulnerabilities.js";
import {
    makeVulnerability,
    createMockVulnerabilityService,
    createMockOsvCacheService
} from "./vulnerabilities.testHelpers.js";
import type { TestDb } from "./vulnerabilities.testHelpers.js";

describe("vulnerability routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let vulnerabilityService: VulnerabilityService.Interface;
    let osvCacheService: OsvCacheService.Interface;
    let token: string;

    beforeEach(async () => {
        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;
        vulnerabilityService = createMockVulnerabilityService();
        osvCacheService = createMockOsvCacheService();
        container.registerInstance(VulnerabilityService, vulnerabilityService);
        container.registerInstance(OsvCacheService, osvCacheService);

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(vulnerabilityRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    describe("POST /api/vulnerabilities/:projectId/scan", () => {
        it("triggers a manual scan for the project", async () => {
            const projectId = generateId();
            await db
                .insert(projects)
                .values({
                    id: projectId,
                    name: "test",
                    path: "/repo/test",
                    packageManager: "yarn",
                    addedAt: Date.now()
                })
                .run();

            const scanResult: IVulnerabilityScanResult = {
                vulnerabilities: [makeVulnerability({ projectId })],
                counts: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 },
                total: 1
            };
            vi.mocked(vulnerabilityService.scan).mockResolvedValue(scanResult);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: `/api/vulnerabilities/${projectId}/scan`
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.total).toBe(1);
            expect(body.counts.high).toBe(1);
            expect(vulnerabilityService.scan).toHaveBeenCalledWith({
                projectId,
                projectPath: "/repo/test",
                packageManager: "yarn"
            });
        });

        it("returns 404 when the project does not exist", async () => {
            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/vulnerabilities/does-not-exist/scan"
            });

            expect(response.statusCode).toBe(404);
            expect(vulnerabilityService.scan).not.toHaveBeenCalled();
        });

        it("returns 422 when the project has no detected package manager", async () => {
            const projectId = generateId();
            await db
                .insert(projects)
                .values({
                    id: projectId,
                    name: "test",
                    path: "/repo/test",
                    addedAt: Date.now()
                })
                .run();

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: `/api/vulnerabilities/${projectId}/scan`
            });

            expect(response.statusCode).toBe(422);
            expect(vulnerabilityService.scan).not.toHaveBeenCalled();
        });
    });

    describe("POST /api/vulnerabilities/osv/refresh", () => {
        it("delegates to forceOsvRefresh with the given options", async () => {
            vi.mocked(vulnerabilityService.forceOsvRefresh).mockResolvedValue(5);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/vulnerabilities/osv/refresh",
                payload: { packageName: "lodash" }
            });

            expect(response.statusCode).toBe(200);
            const body = response.json();
            expect(body.invalidated).toBe(5);
            expect(vulnerabilityService.forceOsvRefresh).toHaveBeenCalledWith({
                packageName: "lodash"
            });
        });

        it("supports the 'all' flag with no other filters", async () => {
            vi.mocked(vulnerabilityService.forceOsvRefresh).mockResolvedValue(42);

            const response = await app.inject({
                headers: { authorization: `Bearer ${token}` },
                method: "POST",
                url: "/api/vulnerabilities/osv/refresh",
                payload: { all: true }
            });

            expect(response.statusCode).toBe(200);
            expect(response.json().invalidated).toBe(42);
            expect(vulnerabilityService.forceOsvRefresh).toHaveBeenCalledWith({ all: true });
        });
    });
});
