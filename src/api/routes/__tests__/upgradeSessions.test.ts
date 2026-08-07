import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { createTestSession } from "#testing/helpers/createTestSession.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EmailService } from "#api/services/Email/index.js";
import { UserService as UserServiceRegistration } from "#api/services/UserService.js";
import { AuthService as AuthServiceRegistration } from "#api/services/AuthService.js";
import { createAuthHook } from "#api/middleware/authHook.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { projects } from "#api/db/schema.js";
import { UpgradeSessionService as UpgradeSessionServiceRegistration } from "#api/services/UpgradeSessionService.js";
import { ErrorReporter } from "#api/services/ErrorReporter/index.js";
import { UpgradeSessionStepResolverRegistry } from "#api/services/stepResolvers/StepResolverRegistry.js";
import { SelectPackagesResolver } from "#api/services/stepResolvers/SelectPackagesResolver.js";
import { BranchResolver } from "#api/services/stepResolvers/BranchResolver.js";
import { UpgradeResolver } from "#api/services/stepResolvers/UpgradeResolver.js";
import { RefreshTransientResolver } from "#api/services/stepResolvers/RefreshTransientResolver.js";
import { CommitResolver } from "#api/services/stepResolvers/CommitResolver.js";
import { GitService } from "#api/services/abstractions/GitService.js";
import { UpgradeService } from "#api/services/Upgrade/index.js";
import { StepHookService } from "#api/services/StepHook/index.js";
import { CommandRunner } from "#api/services/CommandRunner/index.js";
import { upgradeSessionRoutes } from "../upgradeSessions.js";

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

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
        db = await createTestDb();
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

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(WebSocketBroadcaster, {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        });
        container.registerInstance(GitService, createMockGitService());
        container.registerInstance(UpgradeService, createMockUpgradeService());
        container.register(SelectPackagesResolver);
        container.register(BranchResolver);
        container.register(UpgradeResolver);
        container.register(RefreshTransientResolver);
        container.register(CommitResolver);
        container.register(UpgradeSessionStepResolverRegistry);
        container.registerInstance(ErrorReporter, {
            reportJobFailure: vi.fn(),
            reportJobWarning: vi.fn(),
            reportStepFailure: vi.fn()
        });
        container.registerInstance(StepHookService, {
            getStepConfig: async () => []
        });
        container.registerInstance(CommandRunner, {
            run: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
            runStreaming: async () => ({ stdout: "", stderr: "", exitCode: 0 })
        });
        container.register(UpgradeSessionServiceRegistration).inSingletonScope();
        container.registerInstance(EmailService, { send: vi.fn() });
        container.register(UserServiceRegistration).inSingletonScope();
        container.register(AuthServiceRegistration).inSingletonScope();

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
