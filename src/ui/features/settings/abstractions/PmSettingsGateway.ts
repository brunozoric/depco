import { createAbstraction } from "#shared/index.js";

export interface ISecuritySetting {
    id: string;
    packageManager: string;
    configFile: string;
    fieldName: string;
    expectedValue: string;
    enabled: boolean;
}

export interface IConfigError {
    type: "json" | "schema";
    message: string;
}

export interface IPmSettingsListResult {
    settings: ISecuritySetting[];
    configSource: "db" | "file" | "error";
    fileManagedPms: string[];
    configError?: IConfigError;
}

export interface IInstallFlagItem {
    flag: string;
    label: string;
    description: string;
    enabled: boolean;
    defaultEnabled: boolean;
    isFileManaged: boolean;
}

export interface IPmGeneralSettings {
    registryUrl: string | null;
    upgradeStrategy: string | null;
}

export interface IPmConfigItem {
    packageManager: string;
    installFlags: IInstallFlagItem[];
    general: IPmGeneralSettings;
}

export interface IPmConfigListResult {
    items: IPmConfigItem[];
    configSource: "db" | "file" | "error";
    fileManagedPms: string[];
    configError?: IConfigError;
}

export interface IUpdatePmConfigBody {
    installFlags?: { [flag: string]: boolean };
    registryUrl?: string;
    upgradeStrategy?: "caret" | "tilde" | "exact" | "latest" | "";
}

export interface IPmSettingsGateway {
    list(): Promise<IPmSettingsListResult>;
    create(
        packageManager: string,
        fieldName: string,
        expectedValue: string
    ): Promise<ISecuritySetting>;
    update(id: string, expectedValue: string): Promise<ISecuritySetting>;
    toggle(id: string): Promise<ISecuritySetting>;
    resetDefaults(packageManager: string): Promise<ISecuritySetting[]>;
    listPmConfig(): Promise<IPmConfigListResult>;
    updatePmConfig(pm: string, settings: IUpdatePmConfigBody): Promise<IPmConfigItem>;
}

export const PmSettingsGateway = createAbstraction<IPmSettingsGateway>("Ui/PmSettingsGateway");

export namespace PmSettingsGateway {
    export type Interface = IPmSettingsGateway;
    export type SecuritySetting = ISecuritySetting;
    export type ListResult = IPmSettingsListResult;
    export type ConfigError = IConfigError;
    export type InstallFlagItem = IInstallFlagItem;
    export type PmGeneralSettings = IPmGeneralSettings;
    export type PmConfigItem = IPmConfigItem;
    export type PmConfigListResult = IPmConfigListResult;
    export type UpdatePmConfigBody = IUpdatePmConfigBody;
}
