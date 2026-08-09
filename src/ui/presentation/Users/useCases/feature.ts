import { createFeature } from "#shared/index.js";
import { UsersFeature } from "../../../features/Users/feature.js";
import { LoadUsersUseCase } from "./LoadUsersUseCase.js";
import { CreateUserUseCase } from "./CreateUserUseCase.js";
import { UpdateUserUseCase } from "./UpdateUserUseCase.js";
import { DeleteUserUseCase } from "./DeleteUserUseCase.js";
import { ForceLogoutUserUseCase } from "./ForceLogoutUserUseCase.js";

export const UsersUseCasesFeature = createFeature({
    name: "Ui/UsersUseCases",
    dependencies: [UsersFeature],
    register(container) {
        container.register(LoadUsersUseCase);
        container.register(CreateUserUseCase);
        container.register(UpdateUserUseCase);
        container.register(DeleteUserUseCase);
        container.register(ForceLogoutUserUseCase);
    }
});
