import { eq, count } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { generateId } from "@webiny/stdlib";
import { pmSecuritySettings } from "./schema.js";
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";

export function seedSecurityDefaults(db: BetterSQLite3Database): void {
    for (const [packageManager, fields] of Object.entries(SECURITY_FIELD_REGISTRY)) {
        const [row] = db
            .select({ total: count() })
            .from(pmSecuritySettings)
            .where(eq(pmSecuritySettings.packageManager, packageManager))
            .all();

        if (row!.total > 0) {
            continue;
        }

        db.insert(pmSecuritySettings)
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
