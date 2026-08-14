import { eq } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { toSecuritySettingResponse } from "./securitySettingsHelper.js";
import { ToggleSecuritySettingUseCase as Abstraction } from "./abstractions/ToggleSecuritySettingUseCase.js";

class ToggleSecuritySettingUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;

            const existing = await db
                .select()
                .from(pmSecuritySettings)
                .where(eq(pmSecuritySettings.id, params.id))
                .get();

            if (!existing) {
                return Result.fail({
                    code: "SETTING_NOT_FOUND",
                    statusCode: 404,
                    message: "Setting not found"
                });
            }

            const newEnabled = existing.enabled === 1 ? 0 : 1;
            await db
                .update(pmSecuritySettings)
                .set({ enabled: newEnabled })
                .where(eq(pmSecuritySettings.id, params.id))
                .run();

            return Result.ok(toSecuritySettingResponse({ ...existing, enabled: newEnabled }));
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const ToggleSecuritySettingUseCase = Abstraction.createImplementation({
    implementation: ToggleSecuritySettingUseCaseImpl,
    dependencies: [DatabaseClient]
});
