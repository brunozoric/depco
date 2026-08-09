import { describe, it, expect, vi, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { StepRunnerFeature } from "../feature.js";
import { StepRunner } from "../abstractions/StepRunner.js";
import type { IStep, IStepContext } from "../abstractions/Step.js";

function createMockStep(overrides: Partial<IStep> = {}): IStep {
    return {
        name: overrides.name ?? "mock-step",
        description: overrides.description ?? "Mock step",
        execute: overrides.execute ?? vi.fn().mockResolvedValue({ success: true }),
        ...(overrides.rollback ? { rollback: overrides.rollback } : {})
    };
}

function createTestContext(overrides: Partial<IStepContext> = {}): IStepContext {
    return {
        dataDirectory: "./test-data",
        envFilePath: "./.env.test",
        options: {},
        results: new Map(),
        ...overrides
    };
}

describe("StepRunner", () => {
    let container: ReturnType<typeof createContainer>;
    let runner: StepRunner.Interface;

    beforeEach(() => {
        container = createContainer();
        StepRunnerFeature.register(container);
        runner = container.resolve(StepRunner);
    });

    it("executes steps in order", async () => {
        const order: string[] = [];
        const step1 = createMockStep({
            name: "step-1",
            execute: vi.fn().mockImplementation(async () => {
                order.push("step-1");
                return { success: true };
            })
        });
        const step2 = createMockStep({
            name: "step-2",
            execute: vi.fn().mockImplementation(async () => {
                order.push("step-2");
                return { success: true };
            })
        });

        await runner.run({ steps: [step1, step2], context: createTestContext() });
        expect(order).toEqual(["step-1", "step-2"]);
    });

    it("stops execution on failure", async () => {
        const step1 = createMockStep({
            name: "failing",
            execute: vi.fn().mockResolvedValue({ success: false, message: "failed" })
        });
        const step2 = createMockStep({ name: "never-reached" });

        await expect(
            runner.run({ steps: [step1, step2], context: createTestContext() })
        ).rejects.toThrow();
        expect(step2.execute).not.toHaveBeenCalled();
    });

    it("calls rollback in reverse order on failure", async () => {
        const order: string[] = [];
        const step1 = createMockStep({
            name: "step-1",
            execute: vi.fn().mockResolvedValue({ success: true }),
            rollback: vi.fn().mockImplementation(async () => {
                order.push("rollback-1");
            })
        });
        const step2 = createMockStep({
            name: "step-2",
            execute: vi.fn().mockResolvedValue({ success: true }),
            rollback: vi.fn().mockImplementation(async () => {
                order.push("rollback-2");
            })
        });
        const step3 = createMockStep({
            name: "step-3",
            execute: vi.fn().mockResolvedValue({ success: false, message: "boom" })
        });

        await expect(
            runner.run({ steps: [step1, step2, step3], context: createTestContext() })
        ).rejects.toThrow();
        expect(order).toEqual(["rollback-2", "rollback-1"]);
    });

    it("skips rollback for steps without rollback method", async () => {
        const step1 = createMockStep({
            name: "no-rollback",
            execute: vi.fn().mockResolvedValue({ success: true })
        });
        const step2 = createMockStep({
            name: "failing",
            execute: vi.fn().mockResolvedValue({ success: false, message: "fail" })
        });

        await expect(
            runner.run({ steps: [step1, step2], context: createTestContext() })
        ).rejects.toThrow();
    });

    it("handles skipped steps without error", async () => {
        const step1 = createMockStep({
            name: "skipped",
            execute: vi
                .fn()
                .mockResolvedValue({ success: true, skipped: true, message: "already exists" })
        });
        const step2 = createMockStep({ name: "runs" });

        await runner.run({ steps: [step1, step2], context: createTestContext() });
        expect(step2.execute).toHaveBeenCalled();
    });

    it("passes shared context through all steps", async () => {
        const step1 = createMockStep({
            name: "writer",
            execute: vi.fn().mockImplementation(async (context: IStepContext) => {
                context.results.set("key", "value");
                return { success: true };
            })
        });
        const step2 = createMockStep({
            name: "reader",
            execute: vi.fn().mockImplementation(async (context: IStepContext) => {
                expect(context.results.get("key")).toBe("value");
                return { success: true };
            })
        });

        await runner.run({ steps: [step1, step2], context: createTestContext() });
    });
});
