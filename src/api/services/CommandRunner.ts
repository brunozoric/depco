import { execa } from "execa";
import { CommandRunner as Abstraction } from "./abstractions/CommandRunner.js";

class ExecaCommandRunnerImpl implements Abstraction.Interface {
    public async run(
        command: string,
        args: string[],
        options: Abstraction.RunOptions
    ): Promise<Abstraction.Result> {
        try {
            const result = await execa(command, args, {
                cwd: options.cwd,
                reject: false,
                ...(options.signal ? { cancelSignal: options.signal } : {})
            });
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.exitCode ?? (result.failed ? 1 : 0)
            };
        } catch (error) {
            return {
                stdout: "",
                stderr: String(error),
                exitCode: 1
            };
        }
    }

    public async runStreaming(
        command: string,
        args: string[],
        options: Abstraction.StreamOptions
    ): Promise<Abstraction.Result> {
        const subprocess = execa(command, args, {
            cwd: options.cwd,
            reject: false,
            ...(options.signal ? { cancelSignal: options.signal } : {})
        });

        subprocess.stdout?.on("data", (chunk: Buffer) => {
            const lines = chunk.toString().split("\n").filter(Boolean);
            for (const line of lines) {
                options.onStdout(line);
            }
        });

        subprocess.stderr?.on("data", (chunk: Buffer) => {
            const lines = chunk.toString().split("\n").filter(Boolean);
            for (const line of lines) {
                options.onStderr(line);
            }
        });

        const result = await subprocess;
        return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode ?? (result.failed ? 1 : 0)
        };
    }
}

export const CommandRunner = Abstraction.createImplementation({
    implementation: ExecaCommandRunnerImpl,
    dependencies: []
});
