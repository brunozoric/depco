import { UsersRepository as Abstraction } from "./abstractions/UsersRepository.js";
import type { UsersGateway } from "./abstractions/UsersGateway.js";

class UsersRepositoryImpl implements Abstraction.Interface {
    private users: UsersGateway.User[] = [];
    private total = 0;

    public getUsers(): UsersGateway.User[] {
        return this.users;
    }

    public getTotal(): number {
        return this.total;
    }

    public setUsers(users: UsersGateway.User[], total: number): void {
        this.users = users;
        this.total = total;
    }
}

export const UsersRepository = Abstraction.createImplementation({
    implementation: UsersRepositoryImpl,
    dependencies: []
});
