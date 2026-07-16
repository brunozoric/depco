import { createAbstraction } from "#shared/index.js";

export interface ICloneProjectUseCase {
    execute(url: string, destination: string, folderName?: string): Promise<string>;
}

export const CloneProjectUseCase =
    createAbstraction<ICloneProjectUseCase>("Ui/CloneProjectUseCase");

export namespace CloneProjectUseCase {
    export type Interface = ICloneProjectUseCase;
}
