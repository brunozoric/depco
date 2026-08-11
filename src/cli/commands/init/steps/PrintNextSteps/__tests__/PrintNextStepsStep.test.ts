import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { PrintNextStepsStep } from "../abstractions/PrintNextStepsStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

describe("PrintNextStepsStep", () => {
    let container: ReturnType<typeof createTestCliContainer>;
    let output: string[];
    const originalInfo = console.info;

    beforeEach(() => {
        output = [];
        console.info = (...args: unknown[]) => output.push(args.join(" "));
        container = createTestCliContainer();
    });

    afterEach(() => {
        console.info = originalInfo;
    });

    it("prints depco start instruction", async () => {
        const step = container.resolve(PrintNextStepsStep);
        const context: IStepContext = {
            dataDirectory: "./data",
            envFilePath: "./.env",
            options: {},
            results: new Map()
        };
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const text = output.join("\n");
        expect(text).toContain("depco start");
    });
});
