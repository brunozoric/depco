import { createFeature } from "#shared/index.js";
import { ListUsersUseCase } from "./ListUsersUseCase.js";
import { GetUserUseCase } from "./GetUserUseCase.js";
import { CreateUserUseCase } from "./CreateUserUseCase.js";
import { UpdateUserUseCase } from "./UpdateUserUseCase.js";
import { DeleteUserUseCase } from "./DeleteUserUseCase.js";
import { ForceLogoutUserUseCase } from "./ForceLogoutUserUseCase.js";

export const UsersUseCasesFeature = createFeature({
    name: "Api/UsersUseCasesFeature",
    register(container) {
        container.register(ListUsersUseCase);
        container.register(GetUserUseCase);
        container.register(CreateUserUseCase);
        container.register(UpdateUserUseCase);
        container.register(DeleteUserUseCase);
        container.register(ForceLogoutUserUseCase);
    }
});
