import { generateId } from "@webiny/stdlib";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { pmSecuritySettings } from "#api/db/schema.js";

// Mirrors the npm defaults defined in src/shared/security/npm.ts,
// so tests can exercise the same config-driven security rules as production.
export async function seedNpmSecuritySettings(db: LibSQLDatabase): Promise<void> {
    await db
        .insert(pmSecuritySettings)
        .values([
            {
                id: generateId(),
                packageManager: "npm",
                configFile: ".npmrc",
                fieldName: "ignore-scripts",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "npm",
                configFile: ".npmrc",
                fieldName: "audit",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "npm",
                configFile: ".npmrc",
                fieldName: "strict-ssl",
                expectedValue: "true"
            }
        ])
        .run();
}

export const VALID_NPMRC = ["ignore-scripts=true", "audit=true", "strict-ssl=true"].join("\n");
