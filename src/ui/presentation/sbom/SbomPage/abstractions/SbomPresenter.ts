import { createAbstraction } from "#shared/index.js";

export interface IProjectOption {
    id: string;
    name: string;
}

export interface ISbomViewModel {
    loading: boolean;
    exporting: boolean;
    error: string | null;
    availableProjects: IProjectOption[];
    selectedProjectId: string | null;
    selectedFormat: string;
    canExportProject: boolean;
}

export interface ISbomPresenter {
    get vm(): ISbomViewModel;
    load(): Promise<void>;
    setSelectedProjectId(projectId: string | null): void;
    setSelectedFormat(format: string): void;
    exportProject(): Promise<void>;
    exportAll(): Promise<void>;
}

export const SbomPresenter = createAbstraction<ISbomPresenter>("Ui/SbomPresenter");

export namespace SbomPresenter {
    export type Interface = ISbomPresenter;
    export type ViewModel = ISbomViewModel;
    export type ProjectOption = IProjectOption;
}
