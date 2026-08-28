import { createAbstraction } from "#shared/index.js";
import type { PackageManagerId } from "#shared/security/index.js";

export interface IFileStepHook {
    position: string;
    name: string;
    command: string;
    executionType: "command" | "script" | "package-script";
    required: boolean;
}

export interface IFileSettings {
    branchTemplate?: string;
    commitTemplate?: string;
    logLevel?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
}

export interface IFilePmSettings {
    security?: { [fieldName: string]: string };
    installFlags?: { [cliFlag: string]: boolean };
    // Explicit `| undefined` (rather than just optional) lets callers assign
    // `undefined` to clear a previously stored registry URL: writeGlobalPmSettings
    // merges this object over the existing one, and JSON.stringify then drops
    // the key entirely from the persisted file.
    registryUrl?: string | undefined;
    upgradeStrategy?: "caret" | "tilde" | "exact" | "latest" | undefined;
}

export interface IFileAllPmSettings {
    [packageManager: string]: IFilePmSettings;
}

export interface IProjectFileConfig {
    stepHooks?: IFileStepHook[];
    settings?: IFileSettings;
    pmSettings?: IFileAllPmSettings;
}

export interface IFileConfigError {
    type: "json" | "schema";
    message: string;
}

export interface IFileConfigResult {
    config: IProjectFileConfig | null;
    error?: IFileConfigError;
}

export interface IFileSettingsResult {
    settings: IFileSettings | null;
    error?: IFileConfigError;
}

export interface IFileConfigService {
    readConfig(projectPath: string): Promise<IProjectFileConfig | null>;
    readGlobalSettings(): Promise<IFileSettingsResult>;
    readGlobalConfig(): Promise<IFileConfigResult>;
    writeGlobalPmSettings(pm: PackageManagerId, settings: IFilePmSettings): Promise<void>;
}

export const FileConfigService = createAbstraction<IFileConfigService>("Api/FileConfigService");

export namespace FileConfigService {
    export type Interface = IFileConfigService;
    export type FileConfig = IProjectFileConfig;
    export type StepHook = IFileStepHook;
    export type Settings = IFileSettings;
    export type PmSettings = IFilePmSettings;
    export type AllPmSettings = IFileAllPmSettings;
    export type ConfigError = IFileConfigError;
    export type ConfigResult = IFileConfigResult;
    export type SettingsResult = IFileSettingsResult;
}
