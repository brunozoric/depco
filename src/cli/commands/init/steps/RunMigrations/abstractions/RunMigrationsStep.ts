import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const RunMigrationsStep = createAbstraction<IStep>("Cli/RunMigrationsStep");

export namespace RunMigrationsStep {
    export type Interface = IStep;
}
