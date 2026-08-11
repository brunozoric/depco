import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { PrintNextStepsStepFeature } from "../feature.js";
import { PrintNextStepsStep } from "../abstractions/PrintNextStepsStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";
import { registerCliLogger } from "#testing/helpers/registerCliLogger.js";

describe("PrintNextStepsStep", () => {
    let container: ReturnType<typeof createContainer>;
    let output: string[];
    const originalInfo = console.info;

    beforeEach(() => {
        output = [];
        console.info = (...args: unknown[]) => output.push(args.join(" "));
        container = createContainer();
        registerCliLogger(container);
        PrintNextStepsStepFeature.register(container);
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
