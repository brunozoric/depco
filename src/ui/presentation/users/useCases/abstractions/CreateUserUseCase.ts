import { createAbstraction } from "#shared/index.js";
import type { UsersGateway } from "../../../../features/users/abstractions/UsersGateway.js";

export interface ICreateUserUseCase {
    execute(input: UsersGateway.CreateInput): Promise<UsersGateway.User>;
}

export const CreateUserUseCase = createAbstraction<ICreateUserUseCase>("Ui/CreateUserUseCase");

export namespace CreateUserUseCase {
    export type Interface = ICreateUserUseCase;
}
