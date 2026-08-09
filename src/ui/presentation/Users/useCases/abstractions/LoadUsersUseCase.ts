import { createAbstraction } from "#shared/index.js";
import type { UsersGateway } from "../../../../features/Users/abstractions/UsersGateway.js";

export interface ILoadUsersUseCase {
    execute(query?: UsersGateway.ListQuery): Promise<void>;
}

export const LoadUsersUseCase = createAbstraction<ILoadUsersUseCase>("Ui/LoadUsersUseCase");

export namespace LoadUsersUseCase {
    export type Interface = ILoadUsersUseCase;
}
