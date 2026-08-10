import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const RenderOutputStep = createAbstraction<IStep>("Cli/RenderOutputStep");

export namespace RenderOutputStep {
    export type Interface = IStep;
}
