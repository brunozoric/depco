import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { PushResolver } from "../PushResolver.js";
import { StepResolver } from "../abstractions/StepResolver.js";
import { GitService } from "../../../Git/index.js";
import type { IStepContext, IStepState } from "../abstractions/StepResolver.js";

function createMockGitService(): GitService.Interface {
    return {
        getCurrentBranch: vi.fn().mockResolvedValue("main"),
        createAndCheckoutBranch: vi.fn(),
        checkout: vi.fn(),
        getStatus: vi.fn(),
        stageAll: vi.fn(),
        commit: vi.fn(),
        push: vi.fn().mockResolvedValue({ success: true, output: "ok" })
    };
}

function createContext(steps: IStepState[]): IStepContext {
    return {
        steps,
        packageManager: "yarn",
        stepOrder: [
            "select-packages",
            "branch",
            "upgrade",
            "refresh-transient",
            "commit",
            "push",
            "create-pr"
        ]
    };
}

describe("PushResolver", () => {
    it("pushes branch from branch step result", async () => {
        const gitService = createMockGitService();
        const container = createContainer();
        container.registerInstance(GitService, gitService);
        container.register(PushResolver);
        const resolver = container.resolve(StepResolver);

        const branchStep: IStepState = {
            type: "branch",
            status: "completed",
            input: {},
            result: { created: true, previousBranch: "main", currentBranch: "deps/upgrade" }
        };

        const result = await resolver.execute({
            projectPath: "/test",
            context: createContext([branchStep]),
            input: {}
        });

        expect(gitService.push).toHaveBeenCalledWith("/test", "origin", "deps/upgrade");
        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.result["branch"]).toBe("deps/upgrade");
    });

    it("uses getCurrentBranch when branch step was skipped", async () => {
        const gitService = createMockGitService();
        vi.mocked(gitService.getCurrentBranch).mockResolvedValue("feature-branch");
        const container = createContainer();
        container.registerInstance(GitService, gitService);
        container.register(PushResolver);
        const resolver = container.resolve(StepResolver);

        const branchStep: IStepState = {
            type: "branch",
            status: "skipped",
            input: {},
            result: { created: false, previousBranch: "main", currentBranch: "main" }
        };

        const result = await resolver.execute({
            projectPath: "/test",
            context: createContext([branchStep]),
            input: {}
        });

        expect(gitService.getCurrentBranch).toHaveBeenCalledWith("/test");
        expect(gitService.push).toHaveBeenCalledWith("/test", "origin", "feature-branch");
        expect(result.updatedStep.result["branch"]).toBe("feature-branch");
    });

    it("throws on push failure", async () => {
        const gitService = createMockGitService();
        vi.mocked(gitService.push).mockResolvedValue({
            success: false,
            output: "fatal: remote rejected"
        });
        const container = createContainer();
        container.registerInstance(GitService, gitService);
        container.register(PushResolver);
        const resolver = container.resolve(StepResolver);

        const branchStep: IStepState = {
            type: "branch",
            status: "completed",
            input: {},
            result: { created: true, previousBranch: "main", currentBranch: "deps/upgrade" }
        };

        await expect(
            resolver.execute({
                projectPath: "/test",
                context: createContext([branchStep]),
                input: {}
            })
        ).rejects.toThrow("fatal: remote rejected");
    });
});
