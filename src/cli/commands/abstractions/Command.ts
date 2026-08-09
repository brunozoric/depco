import { createAbstraction } from "#shared/index.js";
import type { Step } from "../../runner/abstractions/Step.js";

export interface ICommand {
    name: string;
    description: string;
    steps(): Step.Interface[];
    context(): Step.Context;
}

export const Command = createAbstraction<ICommand>("Cli/Command");

export namespace Command {
    export type Interface = ICommand;
}
