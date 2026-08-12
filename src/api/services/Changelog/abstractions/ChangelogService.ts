import { createAbstraction } from "#shared/index.js";
import type { IChangelogEntry } from "#shared/changelog/types.js";

export interface IResetAllFailedPackage {
    packageName: string;
    minVersion: string;
    maxVersion: string;
}

export interface IChangelogService {
    resolve(packageName: string): Promise<void>;
    resetFailed(packageName: string): Promise<void>;
    resetAllFailed(): Promise<IResetAllFailedPackage[]>;
    getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogEntry[]>;
}

export const ChangelogService = createAbstraction<IChangelogService>("Api/ChangelogService");

export namespace ChangelogService {
    export type Interface = IChangelogService;
    export type Entry = IChangelogEntry;
    export type ResetAllFailedPackage = IResetAllFailedPackage;
}
