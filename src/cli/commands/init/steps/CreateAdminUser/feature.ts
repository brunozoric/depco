import { createFeature } from "#shared/index.js";
import { CreateAdminUserStep } from "./CreateAdminUserStep.js";

export const CreateAdminUserStepFeature = createFeature({
    name: "Cli/CreateAdminUserStep",
    register(container) {
        container.register(CreateAdminUserStep).inSingletonScope();
    }
});
