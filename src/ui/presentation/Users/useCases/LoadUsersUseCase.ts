import { LoadUsersUseCase as Abstraction } from "./abstractions/LoadUsersUseCase.js";
import { UsersGateway } from "../../../features/Users/abstractions/UsersGateway.js";
import { UsersRepository } from "../../../features/Users/abstractions/UsersRepository.js";

class LoadUsersUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly gateway: UsersGateway.Interface,
        private readonly repository: UsersRepository.Interface
    ) {}

    public execute = async (query?: UsersGateway.ListQuery): Promise<void> => {
        const response = await this.gateway.list(query);
        this.repository.setUsers(response.items, response.total);
    };
}

export const LoadUsersUseCase = Abstraction.createImplementation({
    implementation: LoadUsersUseCaseImpl,
    dependencies: [UsersGateway, UsersRepository]
});
