import { CreateUserUseCase as Abstraction } from "./abstractions/CreateUserUseCase.js";
import { UsersGateway } from "../../../features/Users/abstractions/UsersGateway.js";

class CreateUserUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: UsersGateway.Interface) {}

    public execute = async (input: UsersGateway.CreateInput): Promise<UsersGateway.User> => {
        return this.gateway.create(input);
    };
}

export const CreateUserUseCase = Abstraction.createImplementation({
    implementation: CreateUserUseCaseImpl,
    dependencies: [UsersGateway]
});
