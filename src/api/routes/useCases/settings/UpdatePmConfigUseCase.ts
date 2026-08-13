import { Result } from "#shared/index.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { buildPmConfigItem } from "./pmConfigHelper.js";
import { UpdatePmConfigUseCase as Abstraction } from "./abstractions/UpdatePmConfigUseCase.js";

class UpdatePmConfigUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly fileConfigService: FileConfigService.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const settings: FileConfigService.PmSettings = {};
            if (params.installFlags !== undefined) {
                settings.installFlags = params.installFlags;
            }
            if (params.registryUrl !== undefined) {
                // Empty string means "clear it" — convert to undefined so
                // writeGlobalPmSettings omits the key from the file entirely,
                // rather than persisting an invalid `registryUrl: ""`.
                settings.registryUrl = params.registryUrl === "" ? undefined : params.registryUrl;
            }
            if (params.upgradeStrategy !== undefined) {
                settings.upgradeStrategy =
                    params.upgradeStrategy === "" ? undefined : params.upgradeStrategy;
            }

            await this.fileConfigService.writeGlobalPmSettings(params.pm, settings);

            const fileConfigResult = await this.fileConfigService.readGlobalConfig();
            const fileConfig = fileConfigResult.config?.pmSettings?.[params.pm];

            return Result.ok(buildPmConfigItem(params.pm, fileConfig, true));
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpdatePmConfigUseCase = Abstraction.createImplementation({
    implementation: UpdatePmConfigUseCaseImpl,
    dependencies: [FileConfigService]
});
