import { createAbstraction } from "#shared/index.js";

export interface IBulkRescanVulnerabilitiesUseCase {
    execute(ids: string[]): Promise<number>;
}

export const BulkRescanVulnerabilitiesUseCase =
    createAbstraction<IBulkRescanVulnerabilitiesUseCase>("Ui/BulkRescanVulnerabilitiesUseCase");

export namespace BulkRescanVulnerabilitiesUseCase {
    export type Interface = IBulkRescanVulnerabilitiesUseCase;
}
