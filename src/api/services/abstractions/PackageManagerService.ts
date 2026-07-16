import { createAbstraction } from "#shared/index.js";
import type { PackageManagerId } from "#shared/security/types.js";
import type { IAuditVulnerability } from "./AuditParserService.js";

export type { PackageManagerId as TPackageManager } from "#shared/security/types.js";

type TPackageManager = PackageManagerId;

export interface IPackageManagerService {
    detect(projectPath: string): Promise<TPackageManager>;
    getVersion(projectPath: string, packageManager: string): Promise<string>;
    updateVersion(
        projectPath: string,
        packageManager: string,
        version: string,
        onLog: (line: string) => void,
        signal?: AbortSignal
    ): Promise<void>;
    audit(projectPath: string, packageManager: string): Promise<IAuditVulnerability[]>;
}

export const PackageManagerService = createAbstraction<IPackageManagerService>(
    "Api/PackageManagerService"
);

export namespace PackageManagerService {
    export type Interface = IPackageManagerService;
    export type PackageManager = TPackageManager;
    export type AuditVulnerability = IAuditVulnerability;
}
