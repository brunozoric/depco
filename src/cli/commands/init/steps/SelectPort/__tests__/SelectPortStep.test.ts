import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { SelectPortStepFeature } from "../feature.js";
import { SelectPortStep } from "../abstractions/SelectPortStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

vi.mock("@inquirer/prompts", () => ({
    input: vi.fn().mockResolvedValue("4000")
}));

function createTestContext(): IStepContext {
    return {
        dataDirectory: "./data",
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("SelectPortStep", () => {
    let container: ReturnType<typeof createContainer>;

    beforeEach(() => {
        container = createContainer();
        SelectPortStepFeature.register(container);
    });

    it("stores selected port in context", async () => {
        const step = container.resolve(SelectPortStep);
        const context = createTestContext();
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(context.results.get("port")).toBe("4000");
    });
});
