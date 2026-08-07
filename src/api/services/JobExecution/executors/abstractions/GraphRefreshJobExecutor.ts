import { createAbstraction } from "#shared/index.js";
import type { JobExecutor } from "./JobExecutor.js";

export interface IGraphRefreshJobExecutor extends JobExecutor.Interface {
    readonly type: "graph-refresh";
}

export const GraphRefreshJobExecutor = createAbstraction<IGraphRefreshJobExecutor>(
    "Api/GraphRefreshJobExecutor"
);

export namespace GraphRefreshJobExecutor {
    export type Interface = IGraphRefreshJobExecutor;
}
