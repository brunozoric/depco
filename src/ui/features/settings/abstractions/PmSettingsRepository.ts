import { createAbstraction } from "#shared/index.js";
import { PmSettingsGateway } from "./PmSettingsGateway.js";
import type { IConfigError } from "./PmSettingsGateway.js";

export interface IPmSettingsRepository {
    getSettings(): PmSettingsGateway.SecuritySetting[];
    setSettings(settings: PmSettingsGateway.SecuritySetting[]): void;
    addSetting(setting: PmSettingsGateway.SecuritySetting): void;
    updateSetting(id: string, expectedValue: string): void;
    updateSettingFromServer(id: string, setting: PmSettingsGateway.SecuritySetting): void;
    toggleSetting(id: string): void;
    getConfigSource(): "db" | "file" | "error";
    setConfigSource(source: "db" | "file" | "error"): void;
    getFileManagedPms(): string[];
    setFileManagedPms(pms: string[]): void;
    getConfigError(): IConfigError | null;
    setConfigError(error: IConfigError | null): void;
    getPmConfigs(): PmSettingsGateway.PmConfigItem[];
    setPmConfigs(items: PmSettingsGateway.PmConfigItem[]): void;
}

export const PmSettingsRepository =
    createAbstraction<IPmSettingsRepository>("Ui/PmSettingsRepository");

export namespace PmSettingsRepository {
    export type Interface = IPmSettingsRepository;
    export type SecuritySetting = PmSettingsGateway.SecuritySetting;
    export type ConfigError = PmSettingsGateway.ConfigError;
    export type PmConfigItem = PmSettingsGateway.PmConfigItem;
}
