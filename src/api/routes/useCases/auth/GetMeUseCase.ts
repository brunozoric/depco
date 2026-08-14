import { Result, unexpectedError } from "#shared/index.js";
import { UserService } from "#api/services/Auth/index.js";
import { GetMeUseCase as Abstraction } from "./abstractions/GetMeUseCase.js";

class GetMeUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly userService: UserService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const user = await this.userService.getById(params.userId);
            if (!user) {
                return Result.fail({
                    code: "UNEXPECTED_ERROR",
                    statusCode: 401,
                    message: "Session expired"
                });
            }
            return Result.ok(user);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetMeUseCase = Abstraction.createImplementation({
    implementation: GetMeUseCaseImpl,
    dependencies: [UserService]
});
