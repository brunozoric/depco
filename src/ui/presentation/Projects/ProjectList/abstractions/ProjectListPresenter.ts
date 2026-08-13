import { createAbstraction } from "#shared/index.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import type { EngineStatus } from "#shared/engines/types.js";

export type ProjectScanStatus = "idle" | "scanning" | "done" | "failed";

export interface IProjectTeamBadge {
    id: string;
    name: string;
    color: string;
}

export interface IProjectListItem {
    id: string;
    name: string;
    path: string;
    pmVersion: string | null;
    packageManager: string | null;
    securityPasses: boolean | null;
    securityChecks: Record<string, boolean> | null;
    lastScannedAt: number | null;
    scanStatus: ProjectScanStatus;
    hasNodeModules: boolean;
    teams: IProjectTeamBadge[];
    engineStatus: EngineStatus | null;
}

export interface IBrowseItem {
    name: string;
    path: string;
}

export interface IScanSummary {
    scannedPath: string;
    scannedCount: number;
    filteredCount: number;
    mode: "workspaces" | "depth";
}

export interface IProjectListViewModel {
    loading: boolean;
    bulkActionRunning: boolean;
    projects: IProjectListItem[];
    addProjectPath: string;
    addProjectLoading: boolean;
    addProjectError: string | null;
    cloneUrl: string;
    cloneFolderName: string;
    cloneLoading: boolean;
    cloneError: string | null;
    browsePath: string;
    browseItems: IBrowseItem[];
    browseLoading: boolean;
    scanResults: IBrowseItem[];
    scanLoading: boolean;
    scanSummary: IScanSummary | null;
    scanDepth: number;
    searchQuery: string;
    selectedProjectIds: string[];
    scanningAllEngines: boolean;
}

export interface IProjectListPresenter {
    get vm(): IProjectListViewModel;
    load: () => Promise<void>;
    setAddProjectPath: (path: string) => void;
    addProject: () => Promise<void>;
    addProjects: (paths: string[]) => Promise<void>;
    removeProject: (id: string) => Promise<void>;
    scanAll: () => Promise<void>;
    scanAllEngines: () => Promise<void>;
    refreshAllSecurity: () => Promise<void>;
    setCloneUrl: (url: string) => void;
    setCloneFolderName: (name: string) => void;
    browseTo: (path: string) => Promise<void>;
    cloneProject: () => Promise<void>;
    install: (projectId: string, flags?: string[]) => Promise<void>;
    getInstallOptions: (packageManager: string) => Promise<IInstallFlagDefinition[]>;
    scanDirectory: () => Promise<void>;
    clearScan: () => void;
    setScanDepth: (depth: number) => void;
    setSearchQuery: (value: string) => void;
    scanProject: (id: string) => Promise<void>;
    toggleProjectSelection: (id: string) => void;
    selectAllProjects: () => void;
    deselectAllProjects: () => void;
    bulkScanSelected: () => Promise<void>;
    dispose: () => void;
}

export const ProjectListPresenter =
    createAbstraction<IProjectListPresenter>("Ui/ProjectListPresenter");

export namespace ProjectListPresenter {
    export type Interface = IProjectListPresenter;
    export type ViewModel = IProjectListViewModel;
    export type ProjectListItem = IProjectListItem;
    export type ScanStatus = ProjectScanStatus;
    export type BrowseItem = IBrowseItem;
    export type ScanSummary = IScanSummary;
}
