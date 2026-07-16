import { createAbstraction } from "#shared/index.js";

export interface IUpgradeService {
    upgradePackage(
        projectPath: string,
        packageName: string,
        targetVersion: string,
        packageManager: string,
        onLog: (line: string) => void,
        signal?: AbortSignal
    ): Promise<void>;
    refreshTransient(
        projectPath: string,
        packageManager: string,
        onLog: (line: string) => void,
        signal?: AbortSignal,
        packageNames?: string[]
    ): Promise<void>;
}

export const UpgradeService = createAbstraction<IUpgradeService>("Api/UpgradeService");

export namespace UpgradeService {
    export type Interface = IUpgradeService;
}
