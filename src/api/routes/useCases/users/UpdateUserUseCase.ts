import { Result } from "#shared/index.js";
import { UserService } from "#api/services/Auth/index.js";
import { UpdateUserUseCase as Abstraction } from "./abstractions/UpdateUserUseCase.js";

const FULL_PERMISSION = "full";

class UpdateUserUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly userService: UserService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const existing = await this.userService.getById(params.id);
            if (!existing) {
                return Result.fail({
                    code: "USER_NOT_FOUND",
                    statusCode: 404,
                    message: "User not found"
                });
            }

            const isSelf = params.id === params.sessionUserId;
            if (!isSelf && params.sessionUserPermission !== FULL_PERMISSION) {
                return Result.fail({
                    code: "INSUFFICIENT_PERMISSION",
                    statusCode: 403,
                    message: "Insufficient permission"
                });
            }

            // Self-service updates are restricted to displayName + password —
            // only a full-permission user acting on someone else's account may
            // change permission or active status.
            const data: UserService.UpdateData = {};
            if (params.displayName !== undefined) {
                data.displayName = params.displayName;
            }
            if (params.password !== undefined) {
                data.password = params.password;
            }
            if (!isSelf) {
                if (params.permission !== undefined) {
                    data.permission = params.permission;
                }
                if (params.isActive !== undefined) {
                    data.isActive = params.isActive;
                }
            }

            const updated = await this.userService.update({ id: params.id, data });
            if (!updated) {
                return Result.fail({
                    code: "USER_NOT_FOUND",
                    statusCode: 404,
                    message: "User not found"
                });
            }

            return Result.ok(updated);
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const UpdateUserUseCase = Abstraction.createImplementation({
    implementation: UpdateUserUseCaseImpl,
    dependencies: [UserService]
});
