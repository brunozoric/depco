import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const SelectPortStep = createAbstraction<IStep>("Cli/SelectPortStep");

export namespace SelectPortStep {
    export type Interface = IStep;
}
