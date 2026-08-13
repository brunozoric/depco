import { Result } from "#shared/index.js";
import { AuthService } from "#api/services/Auth/index.js";
import { RequestMagicLinkUseCase as Abstraction } from "./abstractions/RequestMagicLinkUseCase.js";

class RequestMagicLinkUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly authService: AuthService.Interface) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, never>> {
        try {
            await this.authService.requestMagicLink(params);
        } catch {
            // Silently swallow all errors — the spec requires always
            // returning success to prevent user enumeration. Errors are
            // logged inside AuthService.
        }
        return Result.ok();
    }
}

export const RequestMagicLinkUseCase = Abstraction.createImplementation({
    implementation: RequestMagicLinkUseCaseImpl,
    dependencies: [AuthService]
});
