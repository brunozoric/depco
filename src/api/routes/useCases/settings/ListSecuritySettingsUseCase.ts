import { generateId } from "@webiny/stdlib";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import type { PackageManagerId } from "#shared/security/index.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { toSecuritySettingResponse } from "./securitySettingsHelper.js";
import type { ISecuritySettingResponse } from "./securitySettingsHelper.js";
import { ListSecuritySettingsUseCase as Abstraction } from "./abstractions/ListSecuritySettingsUseCase.js";

class ListSecuritySettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly fileConfigService: FileConfigService.Interface
    ) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const dbRows = await this.databaseClient.db.select().from(pmSecuritySettings).all();
            const fileConfigResult = await this.fileConfigService.readGlobalConfig();

            if (fileConfigResult.error) {
                const items = dbRows.map(toSecuritySettingResponse);
                return Result.ok({
                    items,
                    total: items.length,
                    configSource: "error",
                    fileManagedPms: [],
                    configError: fileConfigResult.error
                });
            }

            const allPmSettings = fileConfigResult.config?.pmSettings;

            const fileSecuritySettings: Record<string, Record<string, string>> = {};
            if (allPmSettings) {
                for (const [pm, pmConfig] of Object.entries(allPmSettings)) {
                    if (pmConfig.security && Object.keys(pmConfig.security).length > 0) {
                        fileSecuritySettings[pm] = pmConfig.security;
                    }
                }
            }

            if (Object.keys(fileSecuritySettings).length === 0) {
                const items = dbRows.map(toSecuritySettingResponse);
                return Result.ok({
                    items,
                    total: items.length,
                    configSource: "db",
                    fileManagedPms: []
                });
            }

            const fileManagedPms = Object.keys(fileSecuritySettings);

            const dbItems = dbRows
                .filter(row => !fileManagedPms.includes(row.packageManager))
                .map(toSecuritySettingResponse);

            const fileItems: ISecuritySettingResponse[] = [];
            for (const [pm, fields] of Object.entries(fileSecuritySettings)) {
                const registry = SECURITY_FIELD_REGISTRY[pm as PackageManagerId];
                if (!registry) {
                    continue;
                }
                for (const [fieldName, expectedValue] of Object.entries(fields)) {
                    const fieldDef = registry.find(f => f.fieldName === fieldName);
                    fileItems.push({
                        id: generateId(),
                        packageManager: pm,
                        configFile: fieldDef?.configFile ?? "",
                        fieldName,
                        expectedValue,
                        enabled: true
                    });
                }
            }

            const items = [...dbItems, ...fileItems];
            return Result.ok({
                items,
                total: items.length,
                configSource: "file",
                fileManagedPms
            });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ListSecuritySettingsUseCase = Abstraction.createImplementation({
    implementation: ListSecuritySettingsUseCaseImpl,
    dependencies: [DatabaseClient, FileConfigService]
});
