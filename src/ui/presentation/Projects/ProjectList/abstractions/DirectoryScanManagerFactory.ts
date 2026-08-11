import { createAbstraction } from "#shared/index.js";
import type { ProjectListPresenter } from "./ProjectListPresenter.js";

export interface IDirectoryScanManager {
    results: ProjectListPresenter.BrowseItem[];
    loading: boolean;
    summary: ProjectListPresenter.ScanSummary | null;
    depth: number;
    scan: () => Promise<string | undefined>;
    clear: () => void;
    setDepth: (depth: number) => void;
}

export interface IDirectoryScanManagerFactoryInput {
    getBrowsePath: () => string;
}

export interface IDirectoryScanManagerFactory {
    create(input: IDirectoryScanManagerFactoryInput): IDirectoryScanManager;
}

export const DirectoryScanManagerFactory = createAbstraction<IDirectoryScanManagerFactory>(
    "Ui/DirectoryScanManagerFactory"
);

export namespace DirectoryScanManagerFactory {
    export type Interface = IDirectoryScanManagerFactory;
    export type Input = IDirectoryScanManagerFactoryInput;
    export type Manager = IDirectoryScanManager;
}
