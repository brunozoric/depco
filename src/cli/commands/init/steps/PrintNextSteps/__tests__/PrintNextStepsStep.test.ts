import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { PrintNextStepsStepFeature } from "../feature.js";
import { PrintNextStepsStep } from "../abstractions/PrintNextStepsStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

describe("PrintNextStepsStep", () => {
    let container: ReturnType<typeof createContainer>;
    let output: string[];
    const originalLog = console.log;

    beforeEach(() => {
        output = [];
        console.log = (...args: unknown[]) => output.push(args.join(" "));
        container = createContainer();
        PrintNextStepsStepFeature.register(container);
    });

    afterEach(() => {
        console.log = originalLog;
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
