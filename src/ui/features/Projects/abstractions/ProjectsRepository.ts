import { createAbstraction } from "#shared/index.js";
import { ProjectsGateway } from "./ProjectsGateway.js";

export interface IProjectsRepository {
    getProjects(): ProjectsGateway.Project[];
    getProjectsTotal(): number;
    setProjects(projects: ProjectsGateway.Project[], total: number): void;
    getProject(id: string): ProjectsGateway.Project | undefined;
    updateProject(project: ProjectsGateway.Project): void;
    getDependencies(projectId: string): ProjectsGateway.DependenciesResponse | undefined;
    setDependencies(projectId: string, dependencies: ProjectsGateway.DependenciesResponse): void;
    getSecurityStatus(projectId: string): ProjectsGateway.SecurityStatus | undefined;
    setSecurityStatus(projectId: string, status: ProjectsGateway.SecurityStatus): void;
    clear(projectId: string): void;
}

export const ProjectsRepository = createAbstraction<IProjectsRepository>("Ui/ProjectsRepository");

export namespace ProjectsRepository {
    export type Interface = IProjectsRepository;
    export type Project = ProjectsGateway.Project;
    export type Dependency = ProjectsGateway.Dependency;
    export type SecurityStatus = ProjectsGateway.SecurityStatus;
    export type DependenciesResponse = ProjectsGateway.DependenciesResponse;
}
