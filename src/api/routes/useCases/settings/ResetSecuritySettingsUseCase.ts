import { eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SECURITY_FIELD_REGISTRY } from "#shared/security/index.js";
import { pmSecuritySettings } from "#api/db/schema.js";
import { toSecuritySettingResponse } from "./securitySettingsHelper.js";
import { ResetSecuritySettingsUseCase as Abstraction } from "./abstractions/ResetSecuritySettingsUseCase.js";

class ResetSecuritySettingsUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const fields =
            SECURITY_FIELD_REGISTRY[params.packageManager as keyof typeof SECURITY_FIELD_REGISTRY];
        if (!fields) {
            return Result.fail({
                code: "UNKNOWN_PACKAGE_MANAGER",
                statusCode: 400,
                message: `Unknown package manager: ${params.packageManager}`
            });
        }

        try {
            const { db } = this.databaseClient;

            await db
                .delete(pmSecuritySettings)
                .where(eq(pmSecuritySettings.packageManager, params.packageManager))
                .run();

            const rows = fields.map(field => ({
                id: generateId(),
                packageManager: params.packageManager,
                configFile: field.configFile,
                fieldName: field.fieldName,
                expectedValue: field.defaultExpectedValue,
                enabled: 1 as const
            }));

            if (rows.length > 0) {
                await db.insert(pmSecuritySettings).values(rows).run();
            }

            return Result.ok({ items: rows.map(toSecuritySettingResponse), total: rows.length });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const ResetSecuritySettingsUseCase = Abstraction.createImplementation({
    implementation: ResetSecuritySettingsUseCaseImpl,
    dependencies: [DatabaseClient]
});
