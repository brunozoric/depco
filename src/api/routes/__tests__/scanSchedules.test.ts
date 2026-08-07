import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { generateId } from "@webiny/stdlib";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { ScanSchedulerService } from "#api/services/ScanScheduler/index.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { projects, scanSchedules } from "#api/db/schema.js";
import { scanScheduleRoutes } from "../scanSchedules.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

function createMockScheduler(): ScanSchedulerService.Interface {
    return {
        init: vi.fn(),
        stop: vi.fn(),
        scheduleProject: vi.fn(),
        unscheduleProject: vi.fn(),
        onGlobalDefaultChanged: vi.fn(),
        onScanComplete: vi.fn()
    };
}

describe("scan schedule routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let scheduler: ScanSchedulerService.Interface;
    let token: string;

    beforeEach(async () => {
        db = await createTestDb();
        scheduler = createMockScheduler();
        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(ScanSchedulerService, scheduler);
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(scanScheduleRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("GET /api/scan-schedules returns all projects with resolved schedules", async () => {
        const projectId = generateId();
        await db
            .insert(projects)
            .values({ id: projectId, name: "test", path: "/test", addedAt: Date.now() })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/scan-schedules"
        });
        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.items).toHaveLength(1);
        expect(body.items[0].projectId).toBe(projectId);
        expect(body.items[0].source).toBe("default");
        expect(body.globalDefault).toBe("disabled");
    });

    it("PUT /api/scan-schedules/:projectId creates per-project override", async () => {
        const projectId = generateId();
        await db
            .insert(projects)
            .values({ id: projectId, name: "test", path: "/test", addedAt: Date.now() })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "PUT",
            url: `/api/scan-schedules/${projectId}`,
            payload: { interval: "12h" }
        });

        expect(response.statusCode).toBe(200);
        const body = response.json();
        expect(body.item.interval).toBe("12h");
        expect(body.item.projectId).toBe(projectId);
        expect(scheduler.scheduleProject).toHaveBeenCalledWith(projectId);
    });

    it("DELETE /api/scan-schedules/:projectId removes override", async () => {
        const projectId = generateId();
        await db
            .insert(projects)
            .values({ id: projectId, name: "test", path: "/test", addedAt: Date.now() })
            .run();

        const now = Date.now();
        await db
            .insert(scanSchedules)
            .values({
                id: generateId(),
                projectId,
                interval: "12h",
                enabled: 1,
                createdAt: now,
                updatedAt: now
            })
            .run();

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "DELETE",
            url: `/api/scan-schedules/${projectId}`
        });

        expect(response.statusCode).toBe(204);
        expect(scheduler.scheduleProject).toHaveBeenCalledWith(projectId);
    });

    it("GET /api/settings/scan-schedule-default returns disabled when unset", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: "/api/settings/scan-schedule-default"
        });
        expect(response.statusCode).toBe(200);
        expect(response.json().item.interval).toBe("disabled");
    });

    it("PUT /api/settings/scan-schedule-default sets global default", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "PUT",
            url: "/api/settings/scan-schedule-default",
            payload: { interval: "24h" }
        });

        expect(response.statusCode).toBe(200);
        expect(response.json().item.interval).toBe("24h");
        expect(scheduler.onGlobalDefaultChanged).toHaveBeenCalled();
    });
});
