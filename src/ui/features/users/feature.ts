import { createFeature } from "#shared/index.js";
import { UsersGateway } from "./UsersGateway.js";
import { UsersRepository } from "./UsersRepository.js";

export const UsersFeature = createFeature({
    name: "Ui/Users",
    register(container) {
        container.register(UsersGateway).inSingletonScope();
        container.register(UsersRepository).inSingletonScope();
    }
});
