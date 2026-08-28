import type { FileConfigService } from "#api/services/FileConfig/index.js";

export const TOKEN_KEYS = new Set(["github_token", "gitlab_token"]);

export interface IAppSettingItem {
    key: string;
    value: string;
}

export interface IFileKeyMapping {
    fileKey: keyof FileConfigService.Settings;
    dbKey: string;
}

export const FILE_KEY_MAPPINGS: IFileKeyMapping[] = [
    { fileKey: "branchTemplate", dbKey: "branch_template" },
    { fileKey: "commitTemplate", dbKey: "commit_template" },
    { fileKey: "logLevel", dbKey: "log_level" },
    { fileKey: "consoleLogLevel", dbKey: "console_log_level" },
    { fileKey: "fileLogLevel", dbKey: "file_log_level" }
];

export function maskTokenValue(row: IAppSettingItem): IAppSettingItem {
    return TOKEN_KEYS.has(row.key) && row.value ? { ...row, value: "••••••••" } : row;
}
