import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const StartServerStep = createAbstraction<IStep>("Cli/StartServerStep");

export namespace StartServerStep {
    export type Interface = IStep;
}
