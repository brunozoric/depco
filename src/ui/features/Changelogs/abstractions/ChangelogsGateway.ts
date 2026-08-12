import { createAbstraction } from "#shared/index.js";

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

export interface IChangelogsGateway {
    getStats(): Promise<IChangelogStats>;
    reResolveAll(): Promise<IReResolveAllResult>;
}

export const ChangelogsGateway = createAbstraction<IChangelogsGateway>("Ui/ChangelogsGateway");

export namespace ChangelogsGateway {
    export type Interface = IChangelogsGateway;
    export type Stats = IChangelogStats;
    export type ReResolveAllResult = IReResolveAllResult;
}
