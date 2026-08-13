import { Result } from "#shared/index.js";
import { AuthService } from "#api/services/Auth/index.js";
import { LoginUseCase as Abstraction } from "./abstractions/LoginUseCase.js";
import { toAuthUseCaseError } from "./authErrorHelper.js";

class LoginUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly authService: AuthService.Interface) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        try {
            await this.authService.login(params);
            return Result.ok();
        } catch (error) {
            return Result.fail(toAuthUseCaseError(error, "Login failed"));
        }
    }
}

export const LoginUseCase = Abstraction.createImplementation({
    implementation: LoginUseCaseImpl,
    dependencies: [AuthService]
});
