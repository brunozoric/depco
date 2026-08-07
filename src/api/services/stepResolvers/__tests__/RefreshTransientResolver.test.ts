import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { RefreshTransientResolver } from "../RefreshTransientResolver.js";
import { createDefaultSteps, StepResolver, STEP_ORDER } from "../abstractions/StepResolver.js";
import { UpgradeService } from "../../Upgrade/index.js";

function createResolver(overrides: Partial<UpgradeService.Interface> = {}): StepResolver.Interface {
    const upgradeService: UpgradeService.Interface = {
        upgradePackage: async () => {},
        refreshTransient: async () => {},
        ...overrides
    };
    const container = createContainer();
    container.registerInstance(UpgradeService, upgradeService);
    container.register(RefreshTransientResolver);
    return container.resolve(StepResolver);
}

describe("RefreshTransientResolver", () => {
    it("has type refresh-transient and is not required", () => {
        const resolver = createResolver();
        expect(resolver.type).toBe("refresh-transient");
        expect(resolver.required).toBe(false);
    });

    it("runs refresh when refresh is true", async () => {
        const calls: string[] = [];
        const resolver = createResolver({
            refreshTransient: async (_projectPath, packageManager, onLog) => {
                calls.push(packageManager);
                onLog("refreshed transient dependencies\n");
            }
        });

        const result = await resolver.execute({
            projectPath: "/test",
            context: {
                steps: createDefaultSteps(),
                packageManager: "yarn",
                stepOrder: [...STEP_ORDER]
            },
            input: { refresh: true }
        });

        expect(calls).toEqual(["yarn"]);
        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.result["refreshed"]).toBe(true);
        expect(result.updatedStep.result["logs"]).toContain("refreshed transient dependencies");
        expect(result.nextStep).toBe("commit");
    });

    it("uses package manager from context", async () => {
        const calls: string[] = [];
        const resolver = createResolver({
            refreshTransient: async (_projectPath, packageManager) => {
                calls.push(packageManager);
            }
        });

        await resolver.execute({
            projectPath: "/test",
            context: {
                steps: createDefaultSteps(),
                packageManager: "npm",
                stepOrder: [...STEP_ORDER]
            },
            input: { refresh: true }
        });

        expect(calls).toEqual(["npm"]);
    });

    it("forwards log lines to onProgress callback", async () => {
        const resolver = createResolver({
            refreshTransient: async (_projectPath, _pm, onLog) => {
                onLog("refreshing...\n");
            }
        });

        const onProgress = vi.fn();

        await resolver.execute({
            projectPath: "/test",
            context: {
                steps: createDefaultSteps(),
                packageManager: "yarn",
                stepOrder: [...STEP_ORDER]
            },
            input: { refresh: true },
            onProgress
        });

        expect(onProgress).toHaveBeenCalledWith("refreshing...\n");
    });

    it("skips refresh when refresh is false", async () => {
        let called = false;
        const resolver = createResolver({
            refreshTransient: async () => {
                called = true;
            }
        });

        const result = await resolver.execute({
            projectPath: "/test",
            context: {
                steps: createDefaultSteps(),
                packageManager: "yarn",
                stepOrder: [...STEP_ORDER]
            },
            input: { refresh: false }
        });

        expect(called).toBe(false);
        expect(result.updatedStep.status).toBe("skipped");
        expect(result.updatedStep.result["refreshed"]).toBe(false);
        expect(result.nextStep).toBe("commit");
    });
});
