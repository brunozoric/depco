import { createAbstraction } from "#shared/index.js";
import type { Step } from "./Step.js";

export interface IStepRunnerArgs {
    steps: Step.Interface[];
    context: Step.Context;
}

export interface IStepRunner {
    run(args: IStepRunnerArgs): Promise<void>;
}

export const StepRunner = createAbstraction<IStepRunner>("Cli/StepRunner");

export namespace StepRunner {
    export type Interface = IStepRunner;
    export type Args = IStepRunnerArgs;
}
