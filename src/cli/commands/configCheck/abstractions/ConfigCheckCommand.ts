import { createAbstraction } from "#shared/index.js";
import type { Command } from "../../abstractions/Command.js";

export const ConfigCheckCommand = createAbstraction<Command.Interface>("Cli/ConfigCheckCommand");

export namespace ConfigCheckCommand {
    export type Interface = Command.Interface;
}
