import { UpdateUserUseCase as Abstraction } from "./abstractions/UpdateUserUseCase.js";
import { UsersGateway } from "../../../features/Users/abstractions/UsersGateway.js";

class UpdateUserUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: UsersGateway.Interface) {}

    public execute = async (
        id: string,
        input: UsersGateway.UpdateInput
    ): Promise<UsersGateway.User> => {
        return this.gateway.update(id, input);
    };
}

export const UpdateUserUseCase = Abstraction.createImplementation({
    implementation: UpdateUserUseCaseImpl,
    dependencies: [UsersGateway]
});
