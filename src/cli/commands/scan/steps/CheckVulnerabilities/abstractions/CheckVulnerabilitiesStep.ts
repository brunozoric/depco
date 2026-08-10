import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const CheckVulnerabilitiesStep = createAbstraction<IStep>("Cli/CheckVulnerabilitiesStep");

export namespace CheckVulnerabilitiesStep {
    export type Interface = IStep;
}
