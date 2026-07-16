import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { PrResolver } from "../PrResolver.js";
import { StepResolver } from "../abstractions/StepResolver.js";
import { ForgeService } from "../../abstractions/ForgeService.js";
import { GitService } from "../../abstractions/GitService.js";
import type { IStepContext, IStepState } from "../abstractions/StepResolver.js";

function createMockForgeService(): ForgeService.Interface {
    return {
        detectForge: vi.fn().mockResolvedValue("github"),
        createPr: vi.fn().mockResolvedValue({ url: "https://github.com/o/r/pull/1", number: 1 }),
        parseRemoteUrl: vi.fn().mockReturnValue({ owner: "o", repo: "r" })
    };
}

function createMockGitService(): GitService.Interface {
    return {
        getCurrentBranch: vi.fn().mockResolvedValue("main"),
        createAndCheckoutBranch: vi.fn().mockResolvedValue(undefined),
        checkout: vi.fn().mockResolvedValue(undefined),
        getStatus: vi.fn().mockResolvedValue([]),
        stageAll: vi.fn().mockResolvedValue(undefined),
        commit: vi.fn().mockResolvedValue("abc123"),
        push: vi.fn().mockResolvedValue({ success: true, output: "" })
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

function createStandardSteps(): IStepState[] {
    return [
        {
            type: "select-packages",
            status: "completed",
            input: { packages: [{ name: "lodash", targetVersion: "4.17.21" }] },
            result: {}
        },
        {
            type: "branch",
            status: "completed",
            input: {},
            result: { created: true, previousBranch: "main", currentBranch: "deps/upgrade" }
        },
        {
            type: "push",
            status: "completed",
            input: {},
            result: { remote: "origin", branch: "deps/upgrade" }
        }
    ];
}

describe("PrResolver", () => {
    it("creates PR with user-provided title and body", async () => {
        const forgeService = createMockForgeService();
        const gitService = createMockGitService();
        const container = createContainer();
        container.registerInstance(ForgeService, forgeService);
        container.registerInstance(GitService, gitService);
        container.register(PrResolver);
        const resolver = container.resolve(StepResolver);

        const result = await resolver.execute({
            projectPath: "/test",
            context: createContext(createStandardSteps()),
            input: { title: "My PR", body: "Description" }
        });

        expect(forgeService.createPr).toHaveBeenCalledWith({
            projectPath: "/test",
            title: "My PR",
            body: "Description",
            head: "deps/upgrade",
            base: "main"
        });
        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.result["url"]).toBe("https://github.com/o/r/pull/1");
        expect(result.updatedStep.result["number"]).toBe(1);
    });

    it("auto-skips when push step was skipped", async () => {
        const forgeService = createMockForgeService();
        const gitService = createMockGitService();
        const container = createContainer();
        container.registerInstance(ForgeService, forgeService);
        container.registerInstance(GitService, gitService);
        container.register(PrResolver);
        const resolver = container.resolve(StepResolver);

        const steps = createStandardSteps();
        steps[2] = { ...steps[2]!, status: "skipped", result: {} };

        const result = await resolver.execute({
            projectPath: "/test",
            context: createContext(steps),
            input: {}
        });

        expect(result.updatedStep.status).toBe("skipped");
        expect(result.updatedStep.result["reason"]).toContain("Push step was skipped");
        expect(forgeService.createPr).not.toHaveBeenCalled();
    });

    it("throws when forge is unknown", async () => {
        const forgeService = createMockForgeService();
        vi.mocked(forgeService.detectForge).mockResolvedValue("unknown");
        const gitService = createMockGitService();
        const container = createContainer();
        container.registerInstance(ForgeService, forgeService);
        container.registerInstance(GitService, gitService);
        container.register(PrResolver);
        const resolver = container.resolve(StepResolver);

        await expect(
            resolver.execute({
                projectPath: "/test",
                context: createContext(createStandardSteps()),
                input: { title: "PR", body: "" }
            })
        ).rejects.toThrow("Cannot detect git forge from remote URL");
    });

    it("reads base branch from branch step previousBranch", async () => {
        const forgeService = createMockForgeService();
        const gitService = createMockGitService();
        const container = createContainer();
        container.registerInstance(ForgeService, forgeService);
        container.registerInstance(GitService, gitService);
        container.register(PrResolver);
        const resolver = container.resolve(StepResolver);

        const steps = createStandardSteps();
        steps[1] = {
            type: "branch",
            status: "completed",
            input: {},
            result: { created: true, previousBranch: "develop", currentBranch: "deps/upgrade" }
        };

        await resolver.execute({
            projectPath: "/test",
            context: createContext(steps),
            input: { title: "PR", body: "" }
        });

        expect(forgeService.createPr).toHaveBeenCalledWith(
            expect.objectContaining({ base: "develop" })
        );
    });

    it("falls back to live branch detection when branch step has no previousBranch", async () => {
        const forgeService = createMockForgeService();
        const gitService = createMockGitService();
        vi.mocked(gitService.getCurrentBranch).mockResolvedValue("develop");
        const container = createContainer();
        container.registerInstance(ForgeService, forgeService);
        container.registerInstance(GitService, gitService);
        container.register(PrResolver);
        const resolver = container.resolve(StepResolver);

        const steps = createStandardSteps();
        steps[1] = {
            type: "branch",
            status: "skipped",
            input: {},
            result: {}
        };

        await resolver.execute({
            projectPath: "/test",
            context: createContext(steps),
            input: { title: "PR", body: "" }
        });

        expect(gitService.getCurrentBranch).toHaveBeenCalledWith("/test");
        expect(forgeService.createPr).toHaveBeenCalledWith(
            expect.objectContaining({ base: "develop" })
        );
    });
});
