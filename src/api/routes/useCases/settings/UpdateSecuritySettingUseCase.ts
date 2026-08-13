import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { toSecuritySettingResponse } from "./securitySettingsHelper.js";
import { UpdateSecuritySettingUseCase as Abstraction } from "./abstractions/UpdateSecuritySettingUseCase.js";

class UpdateSecuritySettingUseCaseImpl implements Abstraction.Interface {
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
                return Result.fail({ statusCode: 404, message: "Setting not found" });
            }

            const fields =
                SECURITY_FIELD_REGISTRY[
                    existing.packageManager as keyof typeof SECURITY_FIELD_REGISTRY
                ];
            const fieldDef = fields?.find(f => f.fieldName === existing.fieldName);

            if (fieldDef) {
                const validation = fieldDef.expectedValueSchema.safeParse(params.expectedValue);
                if (!validation.success) {
                    return Result.fail({
                        statusCode: 400,
                        message: validation.error.issues[0]?.message ?? "Invalid expected value"
                    });
                }
            }

            await db
                .update(pmSecuritySettings)
                .set({ expectedValue: params.expectedValue })
                .where(eq(pmSecuritySettings.id, params.id))
                .run();

            return Result.ok(
                toSecuritySettingResponse({ ...existing, expectedValue: params.expectedValue })
            );
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const UpdateSecuritySettingUseCase = Abstraction.createImplementation({
    implementation: UpdateSecuritySettingUseCaseImpl,
    dependencies: [DatabaseClient]
});
