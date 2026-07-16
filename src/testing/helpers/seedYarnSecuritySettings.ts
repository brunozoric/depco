import { generateId } from "@webiny/stdlib";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { pmSecuritySettings } from "#api/db/schema.js";

// Mirrors the Yarn defaults seeded by migration 0001_scan_results_pm_security.sql,
// so tests can exercise the same config-driven security rules as production.
export async function seedYarnSecuritySettings(db: LibSQLDatabase): Promise<void> {
    await db
        .insert(pmSecuritySettings)
        .values([
            {
                id: generateId(),
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "npmPreapprovedPackages",
                expectedValue: "exists"
            },
            {
                id: generateId(),
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "npmMinimalAgeGate",
                expectedValue: "3d"
            },
            {
                id: generateId(),
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "enableScripts",
                expectedValue: "false"
            },
            {
                id: generateId(),
                packageManager: "yarn",
                configFile: ".yarnrc.yml",
                fieldName: "approvedGitRepositories",
                expectedValue: "exists"
            }
        ])
        .run();
}

export const VALID_YARNRC = [
    "npmPreapprovedPackages: []",
    "npmMinimalAgeGate: 3d",
    "enableScripts: false",
    "approvedGitRepositories: []"
].join("\n");
