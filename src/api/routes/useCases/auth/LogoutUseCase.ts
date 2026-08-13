import { createHash } from "crypto";
import { Result } from "#shared/index.js";
import { AuthService } from "#api/services/Auth/index.js";
import { LogoutUseCase as Abstraction } from "./abstractions/LogoutUseCase.js";

class LogoutUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly authService: AuthService.Interface) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, never>> {
        const { authorizationHeader } = params;
        if (authorizationHeader?.startsWith("Bearer ")) {
            const tokenHash = createHash("sha256")
                .update(authorizationHeader.slice(7))
                .digest("hex");
            await this.authService.logout(tokenHash);
        }
        return Result.ok();
    }
}

export const LogoutUseCase = Abstraction.createImplementation({
    implementation: LogoutUseCaseImpl,
    dependencies: [AuthService]
});
