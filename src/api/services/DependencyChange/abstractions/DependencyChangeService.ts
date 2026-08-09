import { createAbstraction } from "#shared/index.js";

export interface IScanResultInput {
    name: string;
    currentVersion: string;
}

export interface IDependencyChangeService {
    detectAndPersist(projectId: string, newScanResults: IScanResultInput[]): Promise<number>;
}

export const DependencyChangeService = createAbstraction<IDependencyChangeService>(
    "Api/DependencyChangeService"
);

export namespace DependencyChangeService {
    export type Interface = IDependencyChangeService;
    export type ScanResultInput = IScanResultInput;
}
