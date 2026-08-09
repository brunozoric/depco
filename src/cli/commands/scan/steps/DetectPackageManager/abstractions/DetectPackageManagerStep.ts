import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const DetectPackageManagerStep = createAbstraction<IStep>("Cli/DetectPackageManagerStep");

export namespace DetectPackageManagerStep {
    export type Interface = IStep;
}
