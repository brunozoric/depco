import { createAbstraction } from "#shared/index.js";
import { AppSettingsGateway } from "./AppSettingsGateway.js";

export interface IAppSettingsRepository {
    getSettings(): AppSettingsGateway.AppSetting[];
    setSettings(settings: AppSettingsGateway.AppSetting[]): void;
    upsertSetting(setting: AppSettingsGateway.AppSetting): void;
    getConfigSource(): "db" | "file" | "error";
    setConfigSource(source: "db" | "file" | "error"): void;
    getFileManaged(): string[];
    setFileManaged(keys: string[]): void;
    getConfigError(): AppSettingsGateway.ConfigError | null;
    setConfigError(error: AppSettingsGateway.ConfigError | null): void;
    getEncryptionAvailable(): boolean;
    setEncryptionAvailable(available: boolean): void;
}

export const AppSettingsRepository = createAbstraction<IAppSettingsRepository>(
    "Ui/AppSettingsRepository"
);

export namespace AppSettingsRepository {
    export type Interface = IAppSettingsRepository;
    export type AppSetting = AppSettingsGateway.AppSetting;
    export type ConfigError = AppSettingsGateway.ConfigError;
}
