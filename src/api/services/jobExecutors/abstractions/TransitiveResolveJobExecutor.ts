import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface ITransitiveResolveJobExecutor extends JobExecutor.Interface {
    readonly type: "transitive-resolve";
}

export const TransitiveResolveJobExecutor = createAbstraction<ITransitiveResolveJobExecutor>(
    "Api/TransitiveResolveJobExecutor"
);

export namespace TransitiveResolveJobExecutor {
    export type Interface = ITransitiveResolveJobExecutor;
}
