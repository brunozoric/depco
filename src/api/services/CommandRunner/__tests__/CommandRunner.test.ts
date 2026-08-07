import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { CommandRunner } from "../CommandRunner/index.js";
import { CommandRunner as CommandRunnerRegistration } from "../CommandRunner.js";

describe("ExecaCommandRunner", () => {
    function resolveRunner(): CommandRunner.Interface {
        const container = createContainer();
        container.register(CommandRunnerRegistration);
        return container.resolve(CommandRunner);
    }

    it("runs a simple command and captures stdout", async () => {
        const runner = resolveRunner();
        const result = await runner.run("echo", ["hello"], { cwd: process.cwd() });

        expect(result.stdout.trim()).toBe("hello");
        expect(result.exitCode).toBe(0);
    });

    it("captures exit code from failing command", async () => {
        const runner = resolveRunner();
        const result = await runner.run("node", ["-e", "process.exit(1)"], {
            cwd: process.cwd()
        });

        expect(result.exitCode).toBe(1);
    });

    it("streams stdout line by line", async () => {
        const lines: string[] = [];
        const runner = resolveRunner();
        await runner.runStreaming("node", ["-e", "console.log('line1'); console.log('line2');"], {
            cwd: process.cwd(),
            onStdout: line => lines.push(line),
            onStderr: () => {}
        });

        expect(lines).toContain("line1");
        expect(lines).toContain("line2");
    });

    it("aborts a running command when signal is triggered", async () => {
        const runner = resolveRunner();

        const controller = new AbortController();
        const promise = runner.run("sleep", ["10"], {
            cwd: process.cwd(),
            signal: controller.signal
        });

        controller.abort();
        const result = await promise;
        expect(result.exitCode).not.toBe(0);
    });

    it("aborts a streaming command when signal is triggered", async () => {
        const runner = resolveRunner();

        const controller = new AbortController();
        const promise = runner.runStreaming("sleep", ["10"], {
            cwd: process.cwd(),
            onStdout: () => {},
            onStderr: () => {},
            signal: controller.signal
        });

        controller.abort();
        const result = await promise;
        expect(result.exitCode).not.toBe(0);
    });

    it("returns an error result when execa throws synchronously", async () => {
        const runner = resolveRunner();

        // execa validates the `cwd` option itself and throws synchronously
        // (before spawning) when it isn't a string or file URL. This is the
        // only reliable way to exercise run()'s catch block, since a normal
        // ENOENT (e.g. a nonexistent command) resolves rather than throws
        // when `reject: false` is used.
        const result = await runner.run("echo", ["hi"], {
            cwd: 123 as unknown as string
        });

        expect(result.exitCode).toBe(1);
        expect(result.stdout).toBe("");
        expect(result.stderr).toContain("cwd");
    });

    it("streams stderr output line by line", async () => {
        const stdoutLines: string[] = [];
        const stderrLines: string[] = [];
        const runner = resolveRunner();

        await runner.runStreaming(
            "node",
            ["-e", "console.error('errline1'); console.error('errline2');"],
            {
                cwd: process.cwd(),
                onStdout: line => stdoutLines.push(line),
                onStderr: line => stderrLines.push(line)
            }
        );

        expect(stderrLines).toContain("errline1");
        expect(stderrLines).toContain("errline2");
        expect(stdoutLines).toEqual([]);
    });
});
