import { createAbstraction } from "#shared/index.js";
import type { DependencyKind } from "./ScanService.js";

export interface ISbomComponent {
    packageName: string;
    version: string;
    spdxId: string | null;
    licenseName: string | null;
    type: DependencyKind;
}

export interface ISbomVulnerability {
    advisoryId: string;
    severity: string;
    packageName: string;
    source: string;
    advisoryUrl: string | null;
}

export interface ISbomDependencyEdge {
    parentPackage: string | null;
    parentVersion: string | null;
    childPackage: string;
    childVersion: string;
}

export interface ISbomProjectData {
    projectName: string;
    projectPath: string;
    packageManager: string | null;
    components: ISbomComponent[];
    vulnerabilities: ISbomVulnerability[];
    edges: ISbomDependencyEdge[];
}

export interface ISbomService {
    collectForProject(projectId: string): Promise<ISbomProjectData>;
    collectForAllProjects(): Promise<ISbomProjectData>;
}

export const SbomService = createAbstraction<ISbomService>("Api/SbomService");

export namespace SbomService {
    export type Interface = ISbomService;
    export type Component = ISbomComponent;
    export type Vulnerability = ISbomVulnerability;
    export type DependencyEdge = ISbomDependencyEdge;
    export type ProjectData = ISbomProjectData;
}
