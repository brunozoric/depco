import { Result } from "#shared/index.js";
import { LicenseQueryService } from "#api/services/License/index.js";
import { GetLicenseSummaryUseCase as Abstraction } from "./abstractions/GetLicenseSummaryUseCase.js";

class GetLicenseSummaryUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly licenseQueryService: LicenseQueryService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const summary = await this.licenseQueryService.getLicenseSummary(params);
            return Result.ok(summary);
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const GetLicenseSummaryUseCase = Abstraction.createImplementation({
    implementation: GetLicenseSummaryUseCaseImpl,
    dependencies: [LicenseQueryService]
});
