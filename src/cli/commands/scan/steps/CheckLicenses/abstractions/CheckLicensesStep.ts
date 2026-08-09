import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const CheckLicensesStep = createAbstraction<IStep>("Cli/CheckLicensesStep");

export namespace CheckLicensesStep {
    export type Interface = IStep;
}
