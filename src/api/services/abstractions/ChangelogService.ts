import { createAbstraction } from "#shared/index.js";
import type { IChangelogEntry } from "#shared/changelog/types.js";

export interface IChangelogService {
    resolve(packageName: string): Promise<void>;
    resetFailed(packageName: string): Promise<void>;
    getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogEntry[]>;
}

export const ChangelogService = createAbstraction<IChangelogService>("Api/ChangelogService");

export namespace ChangelogService {
    export type Interface = IChangelogService;
    export type Entry = IChangelogEntry;
}
