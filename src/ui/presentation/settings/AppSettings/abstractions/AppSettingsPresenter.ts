import { createAbstraction } from "#shared/index.js";
import type { IConfigError } from "../../../../features/appSettings/abstractions/AppSettingsGateway.js";

export interface ISettingOption {
    label: string;
    value: string;
}

export interface IAppSettingViewModel {
    key: string;
    value: string;
    label: string;
    description: string;
    options: ISettingOption[] | null;
}

export interface IAppSettingsViewModel {
    loading: boolean;
    error: string | null;
    settings: IAppSettingViewModel[];
    editingKey: string | null;
    configSource: "db" | "file" | "error";
    fileManaged: string[];
    configError: IConfigError | null;
}

export interface IAppSettingsPresenter {
    get vm(): IAppSettingsViewModel;
    load: () => Promise<void>;
    startEdit: (key: string) => void;
    confirmEdit: (value: string) => Promise<void>;
    cancelEdit: () => void;
}

export const AppSettingsPresenter =
    createAbstraction<IAppSettingsPresenter>("Ui/AppSettingsPresenter");

export namespace AppSettingsPresenter {
    export type Interface = IAppSettingsPresenter;
    export type ViewModel = IAppSettingsViewModel;
    export type SettingViewModel = IAppSettingViewModel;
}
