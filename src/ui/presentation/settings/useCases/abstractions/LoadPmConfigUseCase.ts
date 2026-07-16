import { createAbstraction } from "#shared/index.js";

export interface ILoadPmConfigUseCase {
    execute(): Promise<void>;
}

export const LoadPmConfigUseCase =
    createAbstraction<ILoadPmConfigUseCase>("Ui/LoadPmConfigUseCase");

export namespace LoadPmConfigUseCase {
    export type Interface = ILoadPmConfigUseCase;
}
