import { createAbstraction } from "#shared/index.js";
import type { INodeRelease } from "#shared/engines/types.js";

export interface INodeReleaseDataService {
    getSchedule(): Promise<INodeRelease[]>;
}

export const NodeReleaseDataService = createAbstraction<INodeReleaseDataService>(
    "Api/NodeReleaseDataService"
);

export namespace NodeReleaseDataService {
    export type Interface = INodeReleaseDataService;
}
