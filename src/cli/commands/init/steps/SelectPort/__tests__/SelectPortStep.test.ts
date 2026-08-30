import { describe, it, expect, beforeEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { SelectPortStep } from "../abstractions/SelectPortStep.js";
import { PromptService } from "../../../../../services/Prompt/index.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(): IStepContext {
    return {
        dataDirectory: "./data",
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("SelectPortStep", () => {
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        container = createTestCliContainer();
        container.registerInstance(PromptService, {
            text: async () => "4000",
            password: async () => ""
        });
    });

    it("stores selected port in context", async () => {
        const step = container.resolve(SelectPortStep);
        const context = createTestContext();
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        expect(context.results.get("port")).toBe("4000");
    });
});
