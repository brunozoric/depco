import { Result } from "#shared/index.js";
import { UserService } from "#api/services/Auth/index.js";
import { GetUserUseCase as Abstraction } from "./abstractions/GetUserUseCase.js";

class GetUserUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly userService: UserService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const user = await this.userService.getById(params.id);
            if (!user) {
                return Result.fail({
                    code: "USER_NOT_FOUND",
                    statusCode: 404,
                    message: "User not found"
                });
            }

            return Result.ok(user);
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const GetUserUseCase = Abstraction.createImplementation({
    implementation: GetUserUseCaseImpl,
    dependencies: [UserService]
});
