import { Result } from "#shared/index.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { ListLicenseViolationsUseCase as Abstraction } from "./abstractions/ListLicenseViolationsUseCase.js";

class ListLicenseViolationsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly licenseQueryService: LicenseQueryService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const data = await this.licenseQueryService.listViolations(params);
            return Result.ok(data);
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ListLicenseViolationsUseCase = Abstraction.createImplementation({
    implementation: ListLicenseViolationsUseCaseImpl,
    dependencies: [LicenseQueryService]
});
