import { createAbstraction } from "#shared/index.js";
import type { IChangelogEntry } from "#shared/changelog/types.js";

export interface IChangelogStats {
    total: number;
    resolved: number;
    failed: number;
    pending: number;
    byResolver: Record<string, number>;
}

export interface IReResolveAllResult {
    packageCount: number;
}

export interface IChangelogResult {
    entries: IChangelogEntry[];
    resolving: boolean;
}

export interface IChangelogsGateway {
    getStats(): Promise<IChangelogStats>;
    reResolveAll(): Promise<IReResolveAllResult>;
    getChangelogs(packageName: string, from: string, to: string): Promise<IChangelogResult>;
    reResolveChangelogs(packageName: string, from: string, to: string): Promise<IChangelogResult>;
}

export const ChangelogsGateway = createAbstraction<IChangelogsGateway>("Ui/ChangelogsGateway");

export namespace ChangelogsGateway {
    export type Interface = IChangelogsGateway;
    export type Stats = IChangelogStats;
    export type ReResolveAllResult = IReResolveAllResult;
    export type ChangelogEntry = IChangelogEntry;
    export type ChangelogResult = IChangelogResult;
}
