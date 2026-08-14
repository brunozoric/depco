import { Result, unexpectedError } from "#shared/index.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { GetProjectLicensesUseCase as Abstraction } from "./abstractions/GetProjectLicensesUseCase.js";

class GetProjectLicensesUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly licenseQueryService: LicenseQueryService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.licenseQueryService.listProjectLicenses(params);
            return Result.ok(data);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetProjectLicensesUseCase = Abstraction.createImplementation({
    implementation: GetProjectLicensesUseCaseImpl,
    dependencies: [LicenseQueryService]
});
