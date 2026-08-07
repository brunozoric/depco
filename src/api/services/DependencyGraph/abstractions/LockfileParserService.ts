import { createAbstraction } from "#shared/index.js";

export interface IDependencyEdge {
    parentPackage: string | null;
    parentVersion: string | null;
    childPackage: string;
    childVersion: string;
    dependencyType: string;
    depth: number;
}

export interface ILockfileParserService {
    parse(projectPath: string, packageManager: string): Promise<IDependencyEdge[]>;
}

export const LockfileParserService = createAbstraction<ILockfileParserService>(
    "Api/LockfileParserService"
);

export namespace LockfileParserService {
    export type Interface = ILockfileParserService;
    export type DependencyEdge = IDependencyEdge;
}
