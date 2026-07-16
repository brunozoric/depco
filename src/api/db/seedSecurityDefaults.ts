import { eq, count } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { generateId } from "@webiny/stdlib";
import { pmSecuritySettings } from "./schema.js";
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";

export async function seedSecurityDefaults(db: LibSQLDatabase): Promise<void> {
    for (const [packageManager, fields] of Object.entries(SECURITY_FIELD_REGISTRY)) {
        const [row] = await db
            .select({ total: count() })
            .from(pmSecuritySettings)
            .where(eq(pmSecuritySettings.packageManager, packageManager))
            .all();

        if (row!.total > 0) {
            continue;
        }

        await db
            .insert(pmSecuritySettings)
            .values(
                fields.map(field => ({
                    id: generateId(),
                    packageManager: packageManager as PackageManagerId,
                    configFile: field.configFile,
                    fieldName: field.fieldName,
                    expectedValue: field.defaultExpectedValue
                }))
            )
            .run();
    }
}
