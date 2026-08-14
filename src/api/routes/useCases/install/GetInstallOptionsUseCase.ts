import { Result } from "#shared/index.js";
import { PackageManagerDriverRegistry } from "#api/services/PackageManager/abstractions/PackageManagerDriverRegistry.js";
import { GetInstallOptionsUseCase as Abstraction } from "./abstractions/GetInstallOptionsUseCase.js";

class GetInstallOptionsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly driverRegistry: PackageManagerDriverRegistry.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const driver = this.driverRegistry.getDriver(params.packageManager);
            const items = driver.installFlags();

            return Result.ok({ items, total: items.length });
        } catch (error) {
            return Result.fail({
                code: "UNKNOWN_PACKAGE_MANAGER",
                statusCode: 400,
                message: (error as Error).message
            });
        }
    }
}

export const GetInstallOptionsUseCase = Abstraction.createImplementation({
    implementation: GetInstallOptionsUseCaseImpl,
    dependencies: [PackageManagerDriverRegistry]
});
