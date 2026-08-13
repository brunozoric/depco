import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { EncryptionService } from "#api/services/Encryption/index.js";
import { appSettings } from "#api/db/schema.js";
import { TOKEN_KEYS } from "./appSettingsHelper.js";
import { UpsertAppSettingUseCase as Abstraction } from "./abstractions/UpsertAppSettingUseCase.js";

class UpsertAppSettingUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly encryptionService: EncryptionService.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        let storedValue = params.value;

        if (TOKEN_KEYS.has(params.key)) {
            if (!this.encryptionService.isAvailable()) {
                return Result.fail({
                    statusCode: 400,
                    message: "ENCRYPTION_KEY not configured — cannot store tokens"
                });
            }

            try {
                storedValue = await this.encryptionService.encrypt(params.value);
            } catch (error) {
                return Result.fail({ statusCode: 500, message: (error as Error).message });
            }
        }

        try {
            const { db } = this.databaseClient;

            await db
                .insert(appSettings)
                .values({ key: params.key, value: storedValue })
                .onConflictDoUpdate({
                    target: appSettings.key,
                    set: { value: storedValue }
                })
                .run();

            return Result.ok({
                key: params.key,
                value: TOKEN_KEYS.has(params.key) ? "••••••••" : params.value
            });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpsertAppSettingUseCase = Abstraction.createImplementation({
    implementation: UpsertAppSettingUseCaseImpl,
    dependencies: [DatabaseClient, EncryptionService]
});
