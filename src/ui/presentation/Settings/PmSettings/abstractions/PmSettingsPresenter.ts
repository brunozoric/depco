import { createAbstraction } from "#shared/index.js";
import type { PackageManagerId, FieldInputType } from "#shared/security/index.js";
import type { IConfigError } from "../../../../features/Settings/abstractions/PmSettingsGateway.js";

export interface ISecuritySettingViewModel {
    id: string;
    fieldName: string;
    configFile: string;
    description: string;
    expectedValue: string;
    enabled: boolean;
    isOrphaned: boolean;
    helperText: string;
    inputType: FieldInputType;
    isFileManaged: boolean;
}

export interface IAvailableFieldViewModel {
    fieldName: string;
    configFile: string;
    description: string;
    defaultExpectedValue: string;
    helperText: string;
    inputType: FieldInputType;
}

export type PmSettingsTabId = "security" | "install" | "general";

export interface IInstallFlagViewModel {
    flag: string;
    label: string;
    description: string;
    enabled: boolean;
    defaultEnabled: boolean;
    isFileManaged: boolean;
}

export interface IGeneralSettingsViewModel {
    registryUrl: string | null;
    upgradeStrategy: string | null;
}

export interface IConfirmDialogViewModel {
    description: string;
    changes: Record<string, unknown>;
}

export interface IPmSettingsViewModel {
    loading: boolean;
    error: string | null;
    selectedPackageManager: PackageManagerId;
    settings: ISecuritySettingViewModel[];
    availableFields: IAvailableFieldViewModel[];
    editingId: string | null;
    addingField: string | null;
    canReset: boolean;
    configSource: "db" | "file" | "error";
    fileManagedPms: string[];
    configError: IConfigError | null;
    activeTab: PmSettingsTabId;
    installFlags: IInstallFlagViewModel[];
    generalSettings: IGeneralSettingsViewModel;
    confirmDialog: IConfirmDialogViewModel | null;
    saving: boolean;
}

export interface IPmSettingsPresenter {
    get vm(): IPmSettingsViewModel;
    load: () => Promise<void>;
    selectPackageManager: (pm: PackageManagerId) => void;
    startAdd: (fieldName: string) => void;
    confirmAdd: (expectedValue: string) => Promise<void>;
    cancelAdd: () => void;
    startEdit: (id: string) => void;
    confirmEdit: (expectedValue: string) => Promise<void>;
    cancelEdit: () => void;
    toggle: (id: string) => Promise<void>;
    resetToDefaults: () => Promise<void>;
    setActiveTab: (tab: PmSettingsTabId) => void;
    toggleInstallFlag: (flag: string) => void;
    saveRegistryUrl: (url: string) => void;
    saveUpgradeStrategy: (strategy: string) => void;
    confirmSave: () => Promise<void>;
    cancelSave: () => void;
}

export const PmSettingsPresenter =
    createAbstraction<IPmSettingsPresenter>("Ui/PmSettingsPresenter");

export namespace PmSettingsPresenter {
    export type Interface = IPmSettingsPresenter;
    export type ViewModel = IPmSettingsViewModel;
    export type SettingViewModel = ISecuritySettingViewModel;
    export type AvailableFieldViewModel = IAvailableFieldViewModel;
    export type TabId = PmSettingsTabId;
    export type InstallFlagViewModel = IInstallFlagViewModel;
    export type GeneralSettingsViewModel = IGeneralSettingsViewModel;
    export type ConfirmDialogViewModel = IConfirmDialogViewModel;
}
