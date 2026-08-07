import { generateId } from "@webiny/stdlib";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { pmSecuritySettings } from "#api/db/schema.js";

export function seedBunSecuritySettings(db: BetterSQLite3Database): void {
    db.insert(pmSecuritySettings)
        .values([
            {
                id: generateId(),
                packageManager: "bun",
                configFile: "package.json",
                fieldName: "trustedDependencies",
                expectedValue: "exists"
            },
            {
                id: generateId(),
                packageManager: "bun",
                configFile: "bunfig.toml",
                fieldName: "install.exact",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "bun",
                configFile: "bunfig.toml",
                fieldName: "install.frozen",
                expectedValue: "true"
            }
        ])
        .run();
}

export const VALID_BUNFIG_TOML = ["[install]", "exact = true", "frozen = true"].join("\n");

export const VALID_BUN_PACKAGE_JSON = JSON.stringify({
    trustedDependencies: ["esbuild"]
});
