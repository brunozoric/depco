import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const WriteEnvFileStep = createAbstraction<IStep>("Cli/WriteEnvFileStep");

export namespace WriteEnvFileStep {
    export type Interface = IStep;
}
