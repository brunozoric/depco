import { createFeature } from "#shared/index.js";

import { LoginPageFeature } from "./LoginPage/feature.js";

export const AuthPresentationFeature = createFeature({
    name: "Ui/Presentation/Auth",
    dependencies: [LoginPageFeature],
    register() {}
});
