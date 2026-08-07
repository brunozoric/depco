import { DeleteUserUseCase as Abstraction } from "./abstractions/DeleteUserUseCase.js";
import { UsersGateway } from "../../../features/users/abstractions/UsersGateway.js";

class DeleteUserUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: UsersGateway.Interface) {}

    public execute = async (id: string): Promise<void> => {
        await this.gateway.remove(id);
    };
}

export const DeleteUserUseCase = Abstraction.createImplementation({
    implementation: DeleteUserUseCaseImpl,
    dependencies: [UsersGateway]
});
