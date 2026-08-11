import { pmSecuritySettings } from "#api/db/schema.js";

export interface SecuritySettingResponse {
    id: string;
    packageManager: string;
    configFile: string;
    fieldName: string;
    expectedValue: string;
    enabled: boolean;
}

export function toSecuritySettingResponse(
    row: typeof pmSecuritySettings.$inferSelect
): SecuritySettingResponse {
    return {
        id: row.id,
        packageManager: row.packageManager,
        configFile: row.configFile,
        fieldName: row.fieldName,
        expectedValue: row.expectedValue,
        enabled: row.enabled === 1
    };
}
