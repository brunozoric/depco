import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const PrintNextStepsStep = createAbstraction<IStep>("Cli/PrintNextStepsStep");

export namespace PrintNextStepsStep {
    export type Interface = IStep;
}
