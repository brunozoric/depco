import { createAbstraction } from "#shared/index.js";

export interface ICommandRunnerResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export interface ICommandRunnerStreamOptions {
    cwd: string;
    onStdout: (line: string) => void;
    onStderr: (line: string) => void;
    signal?: AbortSignal;
}

export interface ICommandRunnerRunOptions {
    cwd: string;
    signal?: AbortSignal;
}

export interface ICommandRunner {
    run(
        command: string,
        args: string[],
        options: ICommandRunnerRunOptions
    ): Promise<ICommandRunnerResult>;
    runStreaming(
        command: string,
        args: string[],
        options: ICommandRunnerStreamOptions
    ): Promise<ICommandRunnerResult>;
}

export const CommandRunner = createAbstraction<ICommandRunner>("Api/CommandRunner");

export namespace CommandRunner {
    export type Interface = ICommandRunner;
    export type Result = ICommandRunnerResult;
    export type RunOptions = ICommandRunnerRunOptions;
    export type StreamOptions = ICommandRunnerStreamOptions;
}
