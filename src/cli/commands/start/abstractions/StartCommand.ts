import { createAbstraction } from "#shared/index.js";
import type { Command } from "../../abstractions/Command.js";

export const StartCommand = createAbstraction<Command.Interface>("Cli/StartCommand");

export namespace StartCommand {
    export type Interface = Command.Interface;
}
