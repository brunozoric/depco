import { createAbstraction } from "#shared/index.js";
import type { UsersGateway } from "../../../../features/Users/abstractions/UsersGateway.js";

export interface IUpdateUserUseCase {
    execute(id: string, input: UsersGateway.UpdateInput): Promise<UsersGateway.User>;
}

export const UpdateUserUseCase = createAbstraction<IUpdateUserUseCase>("Ui/UpdateUserUseCase");

export namespace UpdateUserUseCase {
    export type Interface = IUpdateUserUseCase;
}
