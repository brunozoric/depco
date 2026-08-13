import { eq, and } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { toSecuritySettingResponse } from "./securitySettingsHelper.js";
import { CreateSecuritySettingUseCase as Abstraction } from "./abstractions/CreateSecuritySettingUseCase.js";

class CreateSecuritySettingUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const fields =
            SECURITY_FIELD_REGISTRY[params.packageManager as keyof typeof SECURITY_FIELD_REGISTRY];
        if (!fields) {
            return Result.fail({
                statusCode: 400,
                message: `Unknown package manager: ${params.packageManager}`
            });
        }

        const fieldDef = fields.find(f => f.fieldName === params.fieldName);
        if (!fieldDef) {
            return Result.fail({
                statusCode: 400,
                message: `Unknown field "${params.fieldName}" for ${params.packageManager}`
            });
        }

        const validation = fieldDef.expectedValueSchema.safeParse(params.expectedValue);
        if (!validation.success) {
            return Result.fail({
                statusCode: 400,
                message: validation.error.issues[0]?.message ?? "Invalid expected value"
            });
        }

        try {
            const { db } = this.databaseClient;

            const existing = await db
                .select()
                .from(pmSecuritySettings)
                .where(
                    and(
                        eq(pmSecuritySettings.packageManager, params.packageManager),
                        eq(pmSecuritySettings.fieldName, params.fieldName)
                    )
                )
                .get();

            if (existing) {
                return Result.fail({
                    statusCode: 409,
                    message: `Setting "${params.fieldName}" already exists for ${params.packageManager}`
                });
            }

            const row = {
                id: generateId(),
                packageManager: params.packageManager,
                configFile: fieldDef.configFile,
                fieldName: params.fieldName,
                expectedValue: params.expectedValue,
                enabled: 1 as const
            };

            await db.insert(pmSecuritySettings).values(row).run();

            return Result.ok(toSecuritySettingResponse(row));
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const CreateSecuritySettingUseCase = Abstraction.createImplementation({
    implementation: CreateSecuritySettingUseCaseImpl,
    dependencies: [DatabaseClient]
});
