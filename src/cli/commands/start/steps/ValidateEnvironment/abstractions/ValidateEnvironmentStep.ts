import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const ValidateEnvironmentStep = createAbstraction<IStep>("Cli/ValidateEnvironmentStep");

export namespace ValidateEnvironmentStep {
    export type Interface = IStep;
}
