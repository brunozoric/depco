import { Result } from "#shared/index.js";
import { UserService } from "#api/services/Auth/index.js";
import { CreateUserUseCase as Abstraction } from "./abstractions/CreateUserUseCase.js";

class CreateUserUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly userService: UserService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const user = await this.userService.create(params);

            return Result.ok(user);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const CreateUserUseCase = Abstraction.createImplementation({
    implementation: CreateUserUseCaseImpl,
    dependencies: [UserService]
});
