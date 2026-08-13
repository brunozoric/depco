import type { pmSecuritySettings } from "#api/db/schema.js";

export interface ISecuritySettingResponse {
    id: string;
    packageManager: string;
    configFile: string;
    fieldName: string;
    expectedValue: string;
    enabled: boolean;
}

export function toSecuritySettingResponse(
    row: typeof pmSecuritySettings.$inferSelect
): ISecuritySettingResponse {
    return {
        id: row.id,
        packageManager: row.packageManager,
        configFile: row.configFile,
        fieldName: row.fieldName,
        expectedValue: row.expectedValue,
        enabled: row.enabled === 1
    };
}
