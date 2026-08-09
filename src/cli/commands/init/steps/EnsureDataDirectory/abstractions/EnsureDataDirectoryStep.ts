import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const EnsureDataDirectoryStep = createAbstraction<IStep>("Cli/EnsureDataDirectoryStep");

export namespace EnsureDataDirectoryStep {
    export type Interface = IStep;
}
