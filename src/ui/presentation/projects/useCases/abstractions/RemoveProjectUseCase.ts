import { createAbstraction } from "#shared/index.js";

export interface IRemoveProjectUseCase {
    execute(id: string): Promise<void>;
}

export const RemoveProjectUseCase =
    createAbstraction<IRemoveProjectUseCase>("Ui/RemoveProjectUseCase");

export namespace RemoveProjectUseCase {
    export type Interface = IRemoveProjectUseCase;
}
