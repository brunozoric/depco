import { createFeature } from "#shared/index.js";
import { UserService } from "./UserService.js";
import { AuthService } from "./AuthService.js";

export const AuthFeature = createFeature({
    name: "Api/AuthFeature",
    register(container) {
        container.register(UserService).inSingletonScope();
        container.register(AuthService).inSingletonScope();
    }
});
