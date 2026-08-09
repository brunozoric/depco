import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const LoadConfigStep = createAbstraction<IStep>("Cli/LoadConfigStep");

export namespace LoadConfigStep {
    export type Interface = IStep;
}
