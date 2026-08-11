import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const CheckEnginesStep = createAbstraction<IStep>("Cli/CheckEnginesStep");

export namespace CheckEnginesStep {
    export type Interface = IStep;
}
