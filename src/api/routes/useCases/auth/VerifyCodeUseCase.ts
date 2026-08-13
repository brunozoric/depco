import { Result } from "#shared/index.js";
import { AuthService } from "#api/services/Auth/index.js";
import { VerifyCodeUseCase as Abstraction } from "./abstractions/VerifyCodeUseCase.js";
import { toAuthUseCaseError } from "./authErrorHelper.js";

class VerifyCodeUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly authService: AuthService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.authService.verifyCode(params);
            return Result.ok(data);
        } catch (error) {
            return Result.fail(toAuthUseCaseError(error, "Verification failed"));
        }
    }
}

export const VerifyCodeUseCase = Abstraction.createImplementation({
    implementation: VerifyCodeUseCaseImpl,
    dependencies: [AuthService]
});
