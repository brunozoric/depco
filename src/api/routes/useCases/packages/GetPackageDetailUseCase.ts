import { Result, unexpectedError } from "#shared/index.js";
import { PackageQueryService } from "#api/services/Package/index.js";
import { GetPackageDetailUseCase as Abstraction } from "./abstractions/GetPackageDetailUseCase.js";

class GetPackageDetailUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly packageQueryService: PackageQueryService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const detail = await this.packageQueryService.getPackageDetail(params.packageName);
            if (!detail) {
                return Result.fail({
                    code: "PACKAGE_NOT_FOUND",
                    statusCode: 404,
                    message: "Package not found"
                });
            }

            return Result.ok(detail);
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const GetPackageDetailUseCase = Abstraction.createImplementation({
    implementation: GetPackageDetailUseCaseImpl,
    dependencies: [PackageQueryService]
});
