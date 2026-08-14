import { Result, unexpectedError } from "#shared/index.js";
import { UserService } from "#api/services/Auth/index.js";
import { ListUsersUseCase as Abstraction } from "./abstractions/ListUsersUseCase.js";

class ListUsersUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly userService: UserService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            // Built up conditionally (rather than a single object literal with
            // `search: params.search ?? undefined`) because exactOptionalPropertyTypes
            // treats an explicit `undefined` value differently from an absent key.
            const listParams: UserService.ListParams = {
                page: params.page,
                pageSize: params.pageSize,
                sortBy: params.sortBy,
                sortOrder: params.sortOrder
            };
            if (params.search !== undefined) {
                listParams.search = params.search;
            }
            if (params.isActive !== undefined) {
                listParams.isActive = params.isActive;
            }

            const result = await this.userService.list(listParams);

            return Result.ok(result);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListUsersUseCase = Abstraction.createImplementation({
    implementation: ListUsersUseCaseImpl,
    dependencies: [UserService]
});
