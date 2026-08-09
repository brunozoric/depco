import { createAbstraction } from "#shared/index.js";
import type { IStep } from "../../../../../runner/abstractions/Step.js";

export const GenerateEncryptionKeyStep = createAbstraction<IStep>("Cli/GenerateEncryptionKeyStep");

export namespace GenerateEncryptionKeyStep {
    export type Interface = IStep;
}
