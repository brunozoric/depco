import { Result, unexpectedError } from "#shared/index.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { ListLicensesUseCase as Abstraction } from "./abstractions/ListLicensesUseCase.js";

class ListLicensesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly licenseQueryService: LicenseQueryService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.licenseQueryService.listLicenses(params);
            return Result.ok(data);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListLicensesUseCase = Abstraction.createImplementation({
    implementation: ListLicensesUseCaseImpl,
    dependencies: [LicenseQueryService]
});
