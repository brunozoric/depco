import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { SelectPackagesResolver } from "../SelectPackagesResolver.js";
import { createDefaultSteps, StepResolver, STEP_ORDER } from "../abstractions/StepResolver.js";

function createResolver(): StepResolver.Interface {
    const container = createContainer();
    container.register(SelectPackagesResolver);
    return container.resolve(StepResolver);
}

describe("SelectPackagesResolver", () => {
    const resolver = createResolver();

    it("has type select-packages and is required", () => {
        expect(resolver.type).toBe("select-packages");
        expect(resolver.required).toBe(true);
    });

    it("stores packages in result and returns next step", async () => {
        const steps = createDefaultSteps();
        const input = {
            packages: [
                { name: "react", targetVersion: "19.0.0" },
                { name: "vitest", targetVersion: "4.2.0" }
            ]
        };

        const result = await resolver.execute({
            projectPath: "/test",
            context: { steps, packageManager: "yarn", stepOrder: [...STEP_ORDER] },
            input
        });

        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.input).toEqual(input);
        expect(result.updatedStep.result).toEqual({ packageCount: 2 });
        expect(result.nextStep).toBe("branch");
    });

    it("throws when packages array is empty", async () => {
        const steps = createDefaultSteps();
        await expect(
            resolver.execute({
                projectPath: "/test",
                context: { steps, packageManager: "yarn", stepOrder: [...STEP_ORDER] },
                input: { packages: [] }
            })
        ).rejects.toThrow("packages must be a non-empty array");
    });

    it("throws when packages is missing", async () => {
        const steps = createDefaultSteps();
        await expect(
            resolver.execute({
                projectPath: "/test",
                context: { steps, packageManager: "yarn", stepOrder: [...STEP_ORDER] },
                input: {}
            })
        ).rejects.toThrow("packages must be a non-empty array");
    });
});
