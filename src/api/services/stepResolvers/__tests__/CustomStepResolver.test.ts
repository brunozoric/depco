import { describe, it, expect, vi } from "vitest";
import { CustomStepResolver } from "../CustomStepResolver.js";
import type { IStepContext } from "../abstractions/StepResolver.js";
import type { CommandRunner } from "../../abstractions/CommandRunner.js";

function createMockCommandRunner(exitCode = 0, stdout = "ok"): CommandRunner.Interface {
    return {
        run: vi.fn().mockResolvedValue({ stdout, stderr: "", exitCode }),
        runStreaming: vi.fn().mockResolvedValue({ stdout, stderr: "", exitCode })
    };
}

const STEP_ORDER = ["pre:upgrade:lint", "upgrade", "post:upgrade:test", "commit"];

function createContext(stepOrder: string[] = STEP_ORDER): IStepContext {
    return {
        steps: stepOrder.map((type, i) => ({
            type,
            status: i === 0 ? ("active" as const) : ("pending" as const),
            input: {},
            result: {}
        })),
        packageManager: "yarn",
        stepOrder
    };
}

describe("CustomStepResolver", () => {
    it("executes a shell command and returns completed step", async () => {
        const runner = createMockCommandRunner();
        const resolver = new CustomStepResolver(
            "pre:upgrade:lint",
            { name: "Lint", command: "eslint .", executionType: "command", required: true },
            runner
        );

        const result = await resolver.execute({
            projectPath: "/project",
            context: createContext(),
            input: {}
        });

        expect(runner.runStreaming).toHaveBeenCalledWith(
            "sh",
            ["-c", "eslint ."],
            expect.objectContaining({ cwd: "/project" })
        );
        expect(result.updatedStep.status).toBe("completed");
        expect(result.updatedStep.type).toBe("pre:upgrade:lint");
        expect(result.nextStep).toBe("upgrade");
    });

    it("executes a script file", async () => {
        const runner = createMockCommandRunner();
        const resolver = new CustomStepResolver(
            "post:commit:notify",
            {
                name: "Notify",
                command: "./scripts/notify.sh",
                executionType: "script",
                required: false
            },
            runner
        );

        const result = await resolver.execute({
            projectPath: "/project",
            context: createContext(),
            input: {}
        });

        expect(runner.runStreaming).toHaveBeenCalledWith(
            "sh",
            ["-c", "./scripts/notify.sh"],
            expect.objectContaining({ cwd: "/project" })
        );
        expect(result.updatedStep.status).toBe("completed");
    });

    it("executes a package-script via package manager", async () => {
        const runner = createMockCommandRunner();
        const resolver = new CustomStepResolver(
            "pre:upgrade:prebuild",
            {
                name: "Prebuild",
                command: "prebuild",
                executionType: "package-script",
                required: true
            },
            runner
        );

        const context = createContext();
        context.packageManager = "npm";

        const result = await resolver.execute({ projectPath: "/project", context, input: {} });

        expect(runner.runStreaming).toHaveBeenCalledWith(
            "npm",
            ["run", "prebuild"],
            expect.objectContaining({ cwd: "/project" })
        );
        expect(result.updatedStep.status).toBe("completed");
    });

    it("throws on failure when required", async () => {
        const runner = createMockCommandRunner(1, "");
        const resolver = new CustomStepResolver(
            "pre:upgrade:lint",
            { name: "Lint", command: "eslint .", executionType: "command", required: true },
            runner
        );

        await expect(
            resolver.execute({ projectPath: "/project", context: createContext(), input: {} })
        ).rejects.toThrow('Custom step "Lint" failed with exit code 1');
    });

    it("returns skipped on failure when not required", async () => {
        const runner = createMockCommandRunner(1, "");
        const resolver = new CustomStepResolver(
            "pre:upgrade:lint",
            { name: "Lint", command: "eslint .", executionType: "command", required: false },
            runner
        );

        const result = await resolver.execute({
            projectPath: "/project",
            context: createContext(),
            input: {}
        });

        expect(result.updatedStep.status).toBe("skipped");
        expect(result.updatedStep.result).toEqual(
            expect.objectContaining({ error: expect.any(String), exitCode: 1 })
        );
        expect(result.nextStep).toBe("upgrade");
    });

    it("streams output through onProgress", async () => {
        const runner: CommandRunner.Interface = {
            run: vi.fn(),
            runStreaming: vi.fn().mockImplementation(async (_cmd, _args, options) => {
                options.onStdout("line 1");
                options.onStdout("line 2");
                return { stdout: "line 1\nline 2", stderr: "", exitCode: 0 };
            })
        };

        const resolver = new CustomStepResolver(
            "pre:upgrade:lint",
            { name: "Lint", command: "eslint .", executionType: "command", required: true },
            runner
        );

        const logs: string[] = [];
        await resolver.execute({
            projectPath: "/project",
            context: createContext(),
            input: {},
            onProgress: log => logs.push(log)
        });

        expect(logs).toEqual(["line 1", "line 2"]);
    });

    it("exposes type and required from constructor", () => {
        const runner = createMockCommandRunner();
        const resolver = new CustomStepResolver(
            "pre:upgrade:lint",
            { name: "Lint", command: "eslint .", executionType: "command", required: false },
            runner
        );

        expect(resolver.type).toBe("pre:upgrade:lint");
        expect(resolver.required).toBe(false);
    });
});
