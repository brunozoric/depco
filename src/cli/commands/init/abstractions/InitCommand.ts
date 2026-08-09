import { createAbstraction } from "#shared/index.js";
import type { Command } from "../../abstractions/Command.js";

export const InitCommand = createAbstraction<Command.Interface>("Cli/InitCommand");

export namespace InitCommand {
    export type Interface = Command.Interface;
}
