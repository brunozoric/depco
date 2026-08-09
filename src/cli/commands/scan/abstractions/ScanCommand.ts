import { createAbstraction } from "#shared/index.js";
import type { Command } from "../../abstractions/Command.js";

export const ScanCommand = createAbstraction<Command.Interface>("Cli/ScanCommand");

export namespace ScanCommand {
    export type Interface = Command.Interface;
}
