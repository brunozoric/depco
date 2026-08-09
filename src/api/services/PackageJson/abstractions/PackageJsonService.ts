import { createAbstraction } from "#shared/index.js";

export interface IDiscoveredScript {
    name: string;
    command: string;
}

export interface IPackageJsonService {
    getScripts(projectPath: string): Promise<IDiscoveredScript[]>;
}

export const PackageJsonService = createAbstraction<IPackageJsonService>("Api/PackageJsonService");

export namespace PackageJsonService {
    export type Interface = IPackageJsonService;
    export type DiscoveredScript = IDiscoveredScript;
}
