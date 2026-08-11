import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { projects } from "#api/db/schema.js";
import { ErrorReporter } from "#api/services/ErrorReporter/index.js";
import { GitService } from "#api/services/Git/index.js";
import { UpgradeService } from "#api/services/Upgrade/index.js";
import { StepHookService } from "#api/services/StepHook/index.js";
import { upgradeSessionRoutes } from "../upgradeSessions.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

function createMockGitService(): GitService.Interface {
    return {
        getCurrentBranch: async () => "main",
        createAndCheckoutBranch: async () => {},
        checkout: async () => {},
        getStatus: async () => [],
        stageAll: async () => {},
        commit: async () => "abc123",
        push: async () => ({ success: true, output: "" })
    };
}

function createMockUpgradeService(): UpgradeService.Interface {
    return {
        upgradePackage: async () => {},
        refreshTransient: async () => {}
    };
}

describe("upgrade session routes", () => {
    let app: FastifyInstance;
    let db: TestDb;
    let token: string;
    const projectId = "p1";

    beforeEach(async () => {
        const result = createTestApiContainer();
        db = result.db;
        const container = result.container;

        await db
            .insert(projects)
            .values({
                id: projectId,
                name: "p1",
                path: "/tmp/p1",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        container.registerInstance(GitService, createMockGitService());
        container.registerInstance(UpgradeService, createMockUpgradeService());
        container.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        container.registerInstance(StepHookService, {
            getStepConfig: async () => []
        });

        app = Fastify();
        app.addHook("onRequest", createAuthHook(container));
        await app.register(upgradeSessionRoutes, { container });
        await app.ready();

        ({ token } = await createTestSession({ db }));
    });

    afterEach(async () => {
        await app.close();
    });

    it("creates a session", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions`,
            payload: {}
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.item.projectId).toBe(projectId);
        expect(json.item.status).toBe("active");
        expect(json.item.currentStep).toBe("select-packages");
    });

    it("returns a session", async () => {
        const createResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions`,
            payload: {}
        });
        const sessionId = createResponse.json().item.id;

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/${projectId}/upgrade-sessions/${sessionId}`
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.item.id).toBe(sessionId);
    });

    it("returns 404 for unknown session", async () => {
        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "GET",
            url: `/api/projects/${projectId}/upgrade-sessions/nonexistent`
        });

        expect(response.statusCode).toBe(404);
        const json = response.json();
        expect(json.error.message).toBeTruthy();
    });

    it("execute advances the step", async () => {
        const createResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions`,
            payload: {}
        });
        const sessionId = createResponse.json().item.id;

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions/${sessionId}/steps/select-packages/execute`,
            payload: { packages: [{ name: "react", targetVersion: "19.0.0" }] }
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.item.currentStep).toBe("branch");
        const selectStep = json.item.steps.find(
            (step: { type: string }) => step.type === "select-packages"
        );
        expect(selectStep.status).toBe("completed");
    });

    it("execute returns 400 for wrong step", async () => {
        const createResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions`,
            payload: {}
        });
        const sessionId = createResponse.json().item.id;

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions/${sessionId}/steps/branch/execute`,
            payload: { create: false }
        });

        expect(response.statusCode).toBe(400);
        const json = response.json();
        expect(json.error.message).toContain("not the current step");
    });

    it("skip skips optional step", async () => {
        const createResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions`,
            payload: {}
        });
        const sessionId = createResponse.json().item.id;

        await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions/${sessionId}/steps/select-packages/execute`,
            payload: { packages: [{ name: "react", targetVersion: "19.0.0" }] }
        });

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions/${sessionId}/steps/branch/skip`,
            payload: {}
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.item.currentStep).toBe("upgrade");
        const branchStep = json.item.steps.find((step: { type: string }) => step.type === "branch");
        expect(branchStep.status).toBe("skipped");
    });

    it("aborts the session", async () => {
        const createResponse = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions`,
            payload: {}
        });
        const sessionId = createResponse.json().item.id;

        const response = await app.inject({
            headers: { authorization: `Bearer ${token}` },
            method: "POST",
            url: `/api/projects/${projectId}/upgrade-sessions/${sessionId}/abort`,
            payload: {}
        });

        expect(response.statusCode).toBe(200);
        const json = response.json();
        expect(json.item.status).toBe("aborted");
    });
});
