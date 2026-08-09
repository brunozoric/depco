import { ForceLogoutUserUseCase as Abstraction } from "./abstractions/ForceLogoutUserUseCase.js";
import { UsersGateway } from "../../../features/Users/abstractions/UsersGateway.js";

class ForceLogoutUserUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly gateway: UsersGateway.Interface) {}

    public execute = async (id: string): Promise<void> => {
        await this.gateway.forceLogout(id);
    };
}

export const ForceLogoutUserUseCase = Abstraction.createImplementation({
    implementation: ForceLogoutUserUseCaseImpl,
    dependencies: [UsersGateway]
});
