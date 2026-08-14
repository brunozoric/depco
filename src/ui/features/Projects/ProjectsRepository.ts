import { ProjectsRepository as Abstraction } from "./abstractions/ProjectsRepository.js";

class ProjectsRepositoryImpl implements Abstraction.Interface {
    private projects: Abstraction.Project[] = [];
    private projectsTotal = 0;
    private readonly dependencies = new Map<string, Abstraction.DependenciesResponse>();
    private readonly securityStatuses = new Map<string, Abstraction.SecurityStatus>();

    public getProjects(): Abstraction.Project[] {
        return this.projects;
    }

    public getProjectsTotal(): number {
        return this.projectsTotal;
    }

    public setProjects(projects: Abstraction.Project[], total: number): void {
        this.projects = projects;
        this.projectsTotal = total;
    }

    public getProject(id: string): Abstraction.Project | undefined {
        return this.projects.find(project => project.id === id);
    }

    public updateProject(project: Abstraction.Project): void {
        const index = this.projects.findIndex(p => p.id === project.id);
        if (index !== -1) {
            this.projects[index] = project;
        }
    }

    public getDependencies(projectId: string): Abstraction.DependenciesResponse | undefined {
        return this.dependencies.get(projectId);
    }

    public setDependencies(
        projectId: string,
        dependencies: Abstraction.DependenciesResponse
    ): void {
        this.dependencies.set(projectId, dependencies);
    }

    public getSecurityStatus(projectId: string): Abstraction.SecurityStatus | undefined {
        return this.securityStatuses.get(projectId);
    }

    public setSecurityStatus(projectId: string, status: Abstraction.SecurityStatus): void {
        this.securityStatuses.set(projectId, status);
    }

    public clear(projectId: string): void {
        this.dependencies.delete(projectId);
        this.securityStatuses.delete(projectId);
    }
}

export const ProjectsRepository = Abstraction.createImplementation({
    implementation: ProjectsRepositoryImpl,
    dependencies: []
});
