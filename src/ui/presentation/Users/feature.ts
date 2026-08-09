import { createFeature } from "#shared/index.js";

import { UserListFeature } from "./UserList/feature.js";
import { UsersUseCasesFeature } from "./useCases/feature.js";

export const UsersDomainFeature = createFeature({
    name: "Ui/Presentation/Users",
    dependencies: [UserListFeature, UsersUseCasesFeature],
    register() {}
});
