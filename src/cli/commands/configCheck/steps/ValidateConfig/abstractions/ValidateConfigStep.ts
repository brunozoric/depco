import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const ValidateConfigStep = createAbstraction<IStep>("Cli/ValidateConfigStep");

export namespace ValidateConfigStep {
    export type Interface = IStep;
}
