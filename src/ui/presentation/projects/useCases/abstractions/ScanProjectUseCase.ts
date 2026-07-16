import { createAbstraction } from "#shared/index.js";

export interface IScanProjectUseCase {
    execute(id: string, force?: boolean): Promise<string>;
}

export const ScanProjectUseCase = createAbstraction<IScanProjectUseCase>("Ui/ScanProjectUseCase");

export namespace ScanProjectUseCase {
    export type Interface = IScanProjectUseCase;
}
