import { createAbstraction } from "#shared/index.js";

export interface IDeleteUserUseCase {
    execute(id: string): Promise<void>;
}

export const DeleteUserUseCase = createAbstraction<IDeleteUserUseCase>("Ui/DeleteUserUseCase");

export namespace DeleteUserUseCase {
    export type Interface = IDeleteUserUseCase;
}
