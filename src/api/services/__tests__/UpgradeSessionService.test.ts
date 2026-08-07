import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { projects } from "#api/db/schema.js";
import { UpgradeSessionService } from "../abstractions/UpgradeSessionService.js";
import { UpgradeSessionService as UpgradeSessionServiceRegistration } from "../UpgradeSessionService.js";
import { ErrorReporter } from "../abstractions/ErrorReporter.js";
import { UpgradeSessionStepResolverRegistry } from "../stepResolvers/StepResolverRegistry.js";
import { SelectPackagesResolver } from "../stepResolvers/SelectPackagesResolver.js";
import { BranchResolver } from "../stepResolvers/BranchResolver.js";
import { UpgradeResolver } from "../stepResolvers/UpgradeResolver.js";
import { RefreshTransientResolver } from "../stepResolvers/RefreshTransientResolver.js";
import { CommitResolver } from "../stepResolvers/CommitResolver.js";
import { StepHookService } from "../abstractions/StepHookService.js";
import { CommandRunner } from "../abstractions/CommandRunner.js";
import { GitService } from "../abstractions/GitService.js";
import { UpgradeService } from "../abstractions/UpgradeService.js";

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

describe("UpgradeSessionService", () => {
    let db: Awaited<ReturnType<typeof createTestDb>>;
    let service: UpgradeSessionService.Interface;
    let broadcaster: WebSocketBroadcaster.Interface;

    beforeEach(async () => {
        db = await createTestDb();
        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "p1",
                path: "/tmp/p1",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        broadcaster = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn(),
            closeConnectionsForUser: vi.fn()
        };

        const container = createContainer();
        container.registerInstance(DatabaseClient, { db });
        container.registerInstance(WebSocketBroadcaster, broadcaster);
        container.registerInstance(GitService, createMockGitService());
        container.registerInstance(UpgradeService, createMockUpgradeService());
        container.register(SelectPackagesResolver);
        container.register(BranchResolver);
        container.register(UpgradeResolver);
        container.register(RefreshTransientResolver);
        container.register(CommitResolver);
        container.register(UpgradeSessionStepResolverRegistry);
        container.register(UpgradeSessionServiceRegistration).inSingletonScope();
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

        service = container.resolve(UpgradeSessionService);
    });

    it("creates a session with all steps pending except first", async () => {
        const session = await service.createSession("p1");

        expect(session.projectId).toBe("p1");
        expect(session.status).toBe("active");
        expect(session.currentStep).toBe("select-packages");
        expect(session.steps).toHaveLength(7);
        expect(session.steps[0]).toMatchObject({ type: "select-packages", status: "active" });
        for (const step of session.steps.slice(1)) {
            expect(step.status).toBe("pending");
        }
    });

    it("retrieves a session by id", async () => {
        const created = await service.createSession("p1");

        const fetched = await service.getSession(created.id, "p1");

        expect(fetched).not.toBeNull();
        expect(fetched!.id).toBe(created.id);
    });

    it("returns null for unknown session", async () => {
        const fetched = await service.getSession("nonexistent", "p1");

        expect(fetched).toBeNull();
    });

    it("executes select-packages step and advances to branch", async () => {
        const created = await service.createSession("p1");

        const updated = await service.executeStep(created.id, "p1", "select-packages", {
            packages: [{ name: "react", targetVersion: "19.0.0" }]
        });

        expect(updated.currentStep).toBe("branch");
        expect(updated.status).toBe("active");
        const selectStep = updated.steps.find(step => step.type === "select-packages");
        expect(selectStep?.status).toBe("completed");
        const branchStep = updated.steps.find(step => step.type === "branch");
        expect(branchStep?.status).toBe("active");
    });

    it("rejects executing a step out of order", async () => {
        const created = await service.createSession("p1");

        await expect(
            service.executeStep(created.id, "p1", "branch", { create: false })
        ).rejects.toThrow("Step branch is not the current step");
    });

    it("skips an optional step", async () => {
        const created = await service.createSession("p1");
        await service.executeStep(created.id, "p1", "select-packages", {
            packages: [{ name: "react", targetVersion: "19.0.0" }]
        });

        const updated = await service.skipStep(created.id, "p1", "branch");

        expect(updated.currentStep).toBe("upgrade");
        const branchStep = updated.steps.find(step => step.type === "branch");
        expect(branchStep?.status).toBe("skipped");
    });

    it("rejects skipping a required step", async () => {
        const created = await service.createSession("p1");

        await expect(service.skipStep(created.id, "p1", "select-packages")).rejects.toThrow(
            "Step select-packages is required and cannot be skipped"
        );
    });

    it("broadcasts step-complete after executing a step", async () => {
        const created = await service.createSession("p1");

        await service.executeStep(created.id, "p1", "select-packages", {
            packages: [{ name: "react", targetVersion: "19.0.0" }]
        });

        expect(broadcaster.broadcast).toHaveBeenCalledWith("upgrade-session:step-complete", {
            sessionId: created.id,
            stepType: "select-packages"
        });
    });

    it("aborts an active session", async () => {
        const created = await service.createSession("p1");

        const updated = await service.abortSession(created.id, "p1");

        expect(updated.status).toBe("aborted");
    });
});
