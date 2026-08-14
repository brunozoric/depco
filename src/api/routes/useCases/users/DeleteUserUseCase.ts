import { Result } from "#shared/index.js";
import { AuthService, UserService } from "#api/services/Auth/index.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { DeleteUserUseCase as Abstraction } from "./abstractions/DeleteUserUseCase.js";

class DeleteUserUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly userService: UserService.Interface,
        private readonly authService: AuthService.Interface,
        private readonly webSocketBroadcaster: WebSocketBroadcaster.Interface
    ) {}

    public async execute(params: Abstraction.Params): Promise<Result<void, Abstraction.Error>> {
        try {
            if (params.id === params.sessionUserId) {
                return Result.fail({
                    code: "CANNOT_DELETE_SELF",
                    statusCode: 400,
                    message: "Cannot delete your own account"
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

            await this.userService.deactivate(params.id);
            await this.authService.forceLogout(params.id);
            this.webSocketBroadcaster.closeConnectionsForUser(params.id);

            return Result.ok();
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const DeleteUserUseCase = Abstraction.createImplementation({
    implementation: DeleteUserUseCaseImpl,
    dependencies: [UserService, AuthService, WebSocketBroadcaster]
});
