import { createAbstraction } from "#shared/index.js";
import type { ProjectScanStatus } from "./ProjectListPresenter.js";

export interface IScanStatusManager {
    readonly isBulkRunning: boolean;
    getStatus(projectId: string): ProjectScanStatus;
    scanProject: (id: string) => Promise<void>;
    scanAll: () => Promise<void>;
    refreshAllSecurity: () => Promise<void>;
    dispose(): void;
}

export interface IScanStatusManagerFactory {
    create(): IScanStatusManager;
}

export const ScanStatusManagerFactory = createAbstraction<IScanStatusManagerFactory>(
    "Ui/ScanStatusManagerFactory"
);

export namespace ScanStatusManagerFactory {
    export type Interface = IScanStatusManagerFactory;
    export type Manager = IScanStatusManager;
}
