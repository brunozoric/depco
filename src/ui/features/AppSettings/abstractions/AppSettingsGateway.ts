import { createAbstraction } from "#shared/index.js";

export interface IAppSetting {
    key: string;
    value: string;
}

export interface IConfigError {
    type: "json" | "schema";
    message: string;
}

export interface IAppSettingsListResult {
    settings: IAppSetting[];
    configSource: "db" | "file" | "error";
    fileManaged: string[];
    configError?: IConfigError;
    encryptionAvailable?: boolean;
}

export interface IAppSettingsGateway {
    list(): Promise<IAppSettingsListResult>;
    upsert(key: string, value: string): Promise<IAppSetting>;
}

export const AppSettingsGateway = createAbstraction<IAppSettingsGateway>("Ui/AppSettingsGateway");

export namespace AppSettingsGateway {
    export type Interface = IAppSettingsGateway;
    export type AppSetting = IAppSetting;
    export type ListResult = IAppSettingsListResult;
    export type ConfigError = IConfigError;
}
