import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { BranchResolver } from "../BranchResolver.js";
import { createDefaultSteps, StepResolver, STEP_ORDER } from "../abstractions/StepResolver.js";
import { GitService } from "../../abstractions/GitService.js";

function createResolver(overrides: Partial<GitService.Interface> = {}): StepResolver.Interface {
    const gitService: GitService.Interface = {
        getCurrentBranch: async () => "main",
        createAndCheckoutBranch: async () => {},
        checkout: async () => {},
        getStatus: async () => [],
        stageAll: async () => {},
        commit: async () => "abc123",
        push: async () => ({ success: true, output: "" }),
        ...overrides
    };
    const container = createContainer();
    container.registerInstance(GitService, gitService);
    container.register(BranchResolver);
    return container.resolve(StepResolver);
}

describe("BranchResolver", () => {
    it("has type branch and is not required", () => {
        const resolver = createResolver();
        expect(resolver.type).toBe("branch");
        expect(resolver.required).toBe(false);
    });

    it("creates a new branch when create is true", async () => {
        const calls: string[] = [];
        const resolver = createResolver({
            getCurrentBranch: async () => "main",
            createAndCheckoutBranch: async (_path, name) => {
                calls.push(name);
            }
        });

        const result = await resolver.execute({
            projectPath: "/test",
            context: {
                steps: createDefaultSteps(),
                packageManager: "yarn",
                stepOrder: [...STEP_ORDER]
            },
            input: { create: true, branchName: "chore/update-deps" }
        });

        expect(calls).toEqual(["chore/update-deps"]);
        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.result).toEqual({
            created: true,
            previousBranch: "main",
            currentBranch: "chore/update-deps"
        });
        expect(result.nextStep).toBe("upgrade");
    });

    it("stays on current branch when create is false", async () => {
        const resolver = createResolver();
        const result = await resolver.execute({
            projectPath: "/test",
            context: {
                steps: createDefaultSteps(),
                packageManager: "yarn",
                stepOrder: [...STEP_ORDER]
            },
            input: { create: false }
        });

        expect(result.updatedStep.result).toEqual({
            created: false,
            previousBranch: "main",
            currentBranch: "main"
        });
    });

    it("throws when create is true but branchName is missing", async () => {
        const resolver = createResolver();
        await expect(
            resolver.execute({
                projectPath: "/test",
                context: {
                    steps: createDefaultSteps(),
                    packageManager: "yarn",
                    stepOrder: [...STEP_ORDER]
                },
                input: { create: true }
            })
        ).rejects.toThrow("branchName is required when create is true");
    });
});
