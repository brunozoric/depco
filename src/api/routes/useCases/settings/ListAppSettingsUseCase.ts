import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/index.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";
import { appSettings } from "#api/db/schema.js";
import { FILE_KEY_MAPPINGS, maskTokenValue } from "./appSettingsHelper.js";
import { ListAppSettingsUseCase as Abstraction } from "./abstractions/ListAppSettingsUseCase.js";

class ListAppSettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly encryptionService: EncryptionService.Interface,
        private readonly fileConfigService: FileConfigService.Interface
    ) {}

    public async execute(): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const items = this.databaseClient.db.select().from(appSettings).all();
            const rows = items.map(maskTokenValue);
            const encryptionAvailable = this.encryptionService.isAvailable();

            const fileSettingsResult = await this.fileConfigService.readGlobalSettings();

            if (fileSettingsResult.error) {
                return Result.ok({
                    items: rows,
                    total: rows.length,
                    configSource: "error",
                    fileManaged: [],
                    configError: fileSettingsResult.error,
                    encryptionAvailable
                });
            }

            const fileSettings = fileSettingsResult.settings;

            if (!fileSettings) {
                return Result.ok({
                    items: rows,
                    total: rows.length,
                    configSource: "db",
                    fileManaged: [],
                    encryptionAvailable
                });
            }

            const fileManaged: string[] = [];
            const merged = rows.map(row => ({ ...row }));

            for (const mapping of FILE_KEY_MAPPINGS) {
                const fileValue = fileSettings[mapping.fileKey];
                if (fileValue !== undefined) {
                    fileManaged.push(mapping.dbKey);
                    const existing = merged.find(row => row.key === mapping.dbKey);
                    if (existing) {
                        existing.value = String(fileValue);
                    } else {
                        merged.push({ key: mapping.dbKey, value: String(fileValue) });
                    }
                }
            }

            return Result.ok({
                items: merged,
                total: merged.length,
                configSource: "file",
                encryptionAvailable,
                fileManaged
            });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ListAppSettingsUseCase = Abstraction.createImplementation({
    implementation: ListAppSettingsUseCaseImpl,
    dependencies: [DatabaseClient, EncryptionService, FileConfigService]
});
