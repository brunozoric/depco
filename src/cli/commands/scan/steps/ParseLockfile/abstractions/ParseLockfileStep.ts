import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const ParseLockfileStep = createAbstraction<IStep>("Cli/ParseLockfileStep");

export namespace ParseLockfileStep {
    export type Interface = IStep;
}
