import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { UpgradeResolver } from "../UpgradeResolver.js";
import { StepResolver } from "../abstractions/StepResolver.js";
import { createDefaultSteps, STEP_ORDER } from "../stepUtils.js";
import { UpgradeService } from "../../../Upgrade/index.js";
import type { IStepState, IStepContext } from "../abstractions/StepResolver.js";

function createResolver(overrides: Partial<UpgradeService.Interface> = {}): StepResolver.Interface {
    const upgradeService: UpgradeService.Interface = {
        upgradePackage: async () => {},
        refreshTransient: async () => {},
        ...overrides
    };
    const container = createContainer();
    container.registerInstance(UpgradeService, upgradeService);
    container.register(UpgradeResolver);
    return container.resolve(StepResolver);
}

function contextWithPackages(packages: unknown, packageManager = "yarn"): IStepContext {
    return { steps: stepsWithPackages(packages), packageManager, stepOrder: [...STEP_ORDER] };
}

function stepsWithPackages(packages: unknown): IStepState[] {
    const steps = createDefaultSteps();
    const selectPackagesStep = steps.find(step => step.type === "select-packages");
    if (!selectPackagesStep) {
        throw new Error("select-packages step missing from default steps");
    }
    selectPackagesStep.input = { packages };
    return steps;
}

describe("UpgradeResolver", () => {
    it("has type upgrade and is required", () => {
        const resolver = createResolver();
        expect(resolver.type).toBe("upgrade");
        expect(resolver.required).toBe(true);
    });

    it("upgrades all packages from select-packages step", async () => {
        const calls: Array<{ name: string; targetVersion: string; packageManager: string }> = [];
        const resolver = createResolver({
            upgradePackage: async (
                _projectPath,
                packageName,
                targetVersion,
                packageManager,
                onLog
            ) => {
                calls.push({ name: packageName, targetVersion, packageManager });
                onLog(`upgraded ${packageName}@${targetVersion}\n`);
            }
        });

        const context = contextWithPackages([
            { name: "react", targetVersion: "19.0.0" },
            { name: "vitest", targetVersion: "4.2.0" }
        ]);

        const result = await resolver.execute({ projectPath: "/test", context, input: {} });

        expect(calls).toEqual([
            { name: "react", targetVersion: "19.0.0", packageManager: "yarn" },
            { name: "vitest", targetVersion: "4.2.0", packageManager: "yarn" }
        ]);
        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.result["upgraded"]).toEqual(["react", "vitest"]);
        expect(result.updatedStep.result["logs"]).toContain("upgraded react@19.0.0");
        expect(result.updatedStep.result["logs"]).toContain("upgraded vitest@4.2.0");
        expect(result.nextStep).toBe("refresh-transient");
    });

    it("uses package manager from context", async () => {
        const calls: string[] = [];
        const resolver = createResolver({
            upgradePackage: async (_path, _name, _version, packageManager) => {
                calls.push(packageManager);
            }
        });

        const context = contextWithPackages([{ name: "react", targetVersion: "19.0.0" }], "pnpm");

        await resolver.execute({ projectPath: "/test", context, input: {} });

        expect(calls).toEqual(["pnpm"]);
    });

    it("forwards log lines to onProgress callback", async () => {
        const resolver = createResolver({
            upgradePackage: async (_path, name, version, _pm, onLog) => {
                onLog(`upgrading ${name}@${version}\n`);
            }
        });

        const context = contextWithPackages([{ name: "react", targetVersion: "19.0.0" }]);
        const onProgress = vi.fn();

        await resolver.execute({ projectPath: "/test", context, input: {}, onProgress });

        expect(onProgress).toHaveBeenCalledWith("upgrading react@19.0.0\n");
    });

    it("throws when select-packages step has no packages", async () => {
        const resolver = createResolver();
        const context = contextWithPackages([]);

        await expect(
            resolver.execute({ projectPath: "/test", context, input: {} })
        ).rejects.toThrow("No packages selected");
    });
});
