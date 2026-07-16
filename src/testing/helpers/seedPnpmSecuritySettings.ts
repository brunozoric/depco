import { generateId } from "@webiny/stdlib";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { pmSecuritySettings } from "#api/db/schema.js";

export async function seedPnpmSecuritySettings(db: LibSQLDatabase): Promise<void> {
    await db
        .insert(pmSecuritySettings)
        .values([
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "ignoreScripts",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "strictSsl",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "strictPeerDependencies",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "minimumReleaseAge",
                expectedValue: "4320"
            },
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "minimumReleaseAgeStrict",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "strictDepBuilds",
                expectedValue: "true"
            },
            {
                id: generateId(),
                packageManager: "pnpm",
                configFile: "pnpm-workspace.yaml",
                fieldName: "blockExoticSubdeps",
                expectedValue: "true"
            }
        ])
        .run();
}

export const VALID_PNPM_WORKSPACE_YAML = [
    "ignoreScripts: true",
    "strictSsl: true",
    "strictPeerDependencies: true",
    "minimumReleaseAge: 4320",
    "minimumReleaseAgeStrict: true",
    "strictDepBuilds: true",
    "blockExoticSubdeps: true"
].join("\n");
