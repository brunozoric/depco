import { Result, unexpectedError } from "#shared/index.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { PACKAGE_MANAGER_IDS } from "#shared/security/index.js";
import { buildDefaultPmItems, buildPmConfigItem } from "./pmConfigHelper.js";
import { ListPmSettingsUseCase as Abstraction } from "./abstractions/ListPmSettingsUseCase.js";

class ListPmSettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly fileConfigService: FileConfigService.Interface) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const fileConfigResult = await this.fileConfigService.readGlobalConfig();

            if (fileConfigResult.error) {
                return Result.ok({
                    items: buildDefaultPmItems(),
                    configSource: "error",
                    fileManagedPms: [],
                    configError: fileConfigResult.error
                });
            }

            const allPmSettings = fileConfigResult.config?.pmSettings;
            const fileManagedPms = allPmSettings ? Object.keys(allPmSettings) : [];
            const configSource: "db" | "file" = fileManagedPms.length > 0 ? "file" : "db";

            const items = PACKAGE_MANAGER_IDS.map(pm =>
                buildPmConfigItem(pm, allPmSettings?.[pm], fileManagedPms.includes(pm))
            );

            return Result.ok({ items, configSource, fileManagedPms });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListPmSettingsUseCase = Abstraction.createImplementation({
    implementation: ListPmSettingsUseCaseImpl,
    dependencies: [FileConfigService]
});
