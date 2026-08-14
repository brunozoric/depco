import { Result, unexpectedError } from "#shared/index.js";
import { AuthService, UserService } from "#api/services/Auth/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { ForceLogoutUserUseCase as Abstraction } from "./abstractions/ForceLogoutUserUseCase.js";

class ForceLogoutUserUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly userService: UserService.Interface,
        private readonly authService: AuthService.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        try {
            if (params.id === params.sessionUserId) {
                return Result.fail({
                    code: "CANNOT_FORCE_LOGOUT_SELF",
                    statusCode: 400,
                    message: "Cannot force-logout your own account"
                });
            }

            const existing = await this.userService.getById(params.id);
            if (!existing) {
                return Result.fail({
                    code: "USER_NOT_FOUND",
                    statusCode: 404,
                    message: "User not found"
                });
            }

            await this.authService.forceLogout(params.id);
            this.webSocketBroadcaster.closeConnectionsForUser(params.id);

            return Result.ok();
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ForceLogoutUserUseCase = Abstraction.createImplementation({
    implementation: ForceLogoutUserUseCaseImpl,
    dependencies: [UserService, AuthService, WebSocketBroadcaster]
});
