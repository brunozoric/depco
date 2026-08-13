import { Result } from "#shared/index.js";
import { AuthService } from "#api/services/Auth/index.js";
import { VerifyMagicLinkUseCase as Abstraction } from "./abstractions/VerifyMagicLinkUseCase.js";
import { toAuthUseCaseError } from "./authErrorHelper.js";

class VerifyMagicLinkUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly authService: AuthService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.authService.verifyMagicLink(params);
            return Result.ok(data);
        } catch (error) {
            return Result.fail(toAuthUseCaseError(error, "Verification failed"));
        }
    }
}

export const VerifyMagicLinkUseCase = Abstraction.createImplementation({
    implementation: VerifyMagicLinkUseCaseImpl,
    dependencies: [AuthService]
});
