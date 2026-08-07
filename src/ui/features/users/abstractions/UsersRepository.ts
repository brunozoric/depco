import { createAbstraction } from "#shared/index.js";
import type { UsersGateway } from "./UsersGateway.js";

export interface IUsersRepository {
    getUsers(): UsersGateway.User[];
    getTotal(): number;
    setUsers(users: UsersGateway.User[], total: number): void;
}

export const UsersRepository = createAbstraction<IUsersRepository>("Ui/UsersRepository");

export namespace UsersRepository {
    export type Interface = IUsersRepository;
}
