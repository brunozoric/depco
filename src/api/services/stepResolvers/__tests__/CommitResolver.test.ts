import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { CommitResolver } from "../CommitResolver.js";
import { createDefaultSteps, StepResolver, STEP_ORDER } from "../abstractions/StepResolver.js";
import { GitService } from "../../Git/index.js";

function createResolver(overrides: Partial<GitService.Interface> = {}): StepResolver.Interface {
    const gitService: GitService.Interface = {
        getCurrentBranch: async () => "main",
        createAndCheckoutBranch: async () => {},
        checkout: async () => {},
        getStatus: async () => [" M file.ts"],
        stageAll: async () => {},
        commit: async () => "abc1234",
        push: async () => ({ success: true, output: "" }),
        ...overrides
    };
    const container = createContainer();
    container.registerInstance(GitService, gitService);
    container.register(CommitResolver);
    return container.resolve(StepResolver);
}

describe("CommitResolver", () => {
    it("has type commit and is not required", () => {
        const resolver = createResolver();
        expect(resolver.type).toBe("commit");
        expect(resolver.required).toBe(false);
    });

    it("stages all and commits with provided message", async () => {
        const calls: string[] = [];
        const resolver = createResolver({
            getStatus: async () => [" M file.ts", " M other.ts"],
            stageAll: async () => {
                calls.push("stageAll");
            },
            commit: async (_projectPath, message) => {
                calls.push(`commit:${message}`);
                return "abc1234";
            }
        });

        const result = await resolver.execute({
            projectPath: "/test",
            context: {
                steps: createDefaultSteps(),
                packageManager: "yarn",
                stepOrder: [...STEP_ORDER]
            },
            input: { message: "chore: upgrade dependencies" }
        });

        expect(calls).toEqual(["stageAll", "commit:chore: upgrade dependencies"]);
        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.result["commitHash"]).toBe("abc1234");
        expect(result.updatedStep.result["filesChanged"]).toBe(2);
        expect(result.nextStep).toBe("push");
    });

    it("throws when message is empty", async () => {
        const resolver = createResolver();
        await expect(
            resolver.execute({
                projectPath: "/test",
                context: {
                    steps: createDefaultSteps(),
                    packageManager: "yarn",
                    stepOrder: [...STEP_ORDER]
                },
                input: { message: "" }
            })
        ).rejects.toThrow("commit message is required");
    });

    it("throws when message is missing", async () => {
        const resolver = createResolver();
        await expect(
            resolver.execute({
                projectPath: "/test",
                context: {
                    steps: createDefaultSteps(),
                    packageManager: "yarn",
                    stepOrder: [...STEP_ORDER]
                },
                input: {}
            })
        ).rejects.toThrow("commit message is required");
    });
});
