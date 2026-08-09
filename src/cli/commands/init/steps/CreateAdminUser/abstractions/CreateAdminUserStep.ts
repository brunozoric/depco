import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const CreateAdminUserStep = createAbstraction<IStep>("Cli/CreateAdminUserStep");

export namespace CreateAdminUserStep {
    export type Interface = IStep;
}
