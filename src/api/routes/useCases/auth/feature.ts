import { createFeature } from "#shared/index.js";
import { LoginUseCase } from "./LoginUseCase.js";
import { VerifyCodeUseCase } from "./VerifyCodeUseCase.js";
import { RequestMagicLinkUseCase } from "./RequestMagicLinkUseCase.js";
import { VerifyMagicLinkUseCase } from "./VerifyMagicLinkUseCase.js";
import { GetMeUseCase } from "./GetMeUseCase.js";
import { LogoutUseCase } from "./LogoutUseCase.js";

export const AuthUseCasesFeature = createFeature({
    name: "Api/AuthUseCasesFeature",
    register(container) {
        container.register(LoginUseCase);
        container.register(VerifyCodeUseCase);
        container.register(RequestMagicLinkUseCase);
        container.register(VerifyMagicLinkUseCase);
        container.register(GetMeUseCase);
        container.register(LogoutUseCase);
    }
});
