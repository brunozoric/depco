import { describe, it, expect, beforeEach } from "vitest";
import { createTestCliContainer } from "#testing/helpers/createTestCliContainer.js";
import { GenerateEncryptionKeyStep } from "../abstractions/GenerateEncryptionKeyStep.js";
import type { IStepContext } from "../../../../../runner/abstractions/Step.js";

function createTestContext(): IStepContext {
    return {
        dataDirectory: "./data",
        envFilePath: "./.env",
        options: {},
        results: new Map()
    };
}

describe("GenerateEncryptionKeyStep", () => {
    let container: ReturnType<typeof createTestCliContainer>;

    beforeEach(() => {
        container = createTestCliContainer();
    });

    it("generates a 64-char hex key and stores in context", async () => {
        const step = container.resolve(GenerateEncryptionKeyStep);
        const context = createTestContext();
        const result = await step.execute(context);
        expect(result.success).toBe(true);
        const key = context.results.get("encryptionKey") as string;
        expect(key).toHaveLength(64);
        expect(key).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique keys on each call", async () => {
        const step = container.resolve(GenerateEncryptionKeyStep);
        const context1 = createTestContext();
        const context2 = createTestContext();
        await step.execute(context1);
        await step.execute(context2);
        expect(context1.results.get("encryptionKey")).not.toBe(
            context2.results.get("encryptionKey")
        );
    });
});
