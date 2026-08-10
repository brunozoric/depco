import { makeAutoObservable } from "mobx";
import type { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";

interface IDependencySelectionManagerDependencies {
    projectsRepository: ProjectsRepository.Interface;
    getProjectId: () => string | null;
}

export class DependencySelectionManager {
    public readonly selectedNames = new Set<string>();

    public constructor(private readonly dependencies: IDependencySelectionManagerDependencies) {
        makeAutoObservable(this);
    }

    public toggle = (name: string): void => {
        if (this.selectedNames.has(name)) {
            this.selectedNames.delete(name);
        } else {
            this.selectedNames.add(name);
        }
    };

    public selectAll = (): void => {
        const projectId = this.dependencies.getProjectId();
        const dependenciesResponse = projectId
            ? this.dependencies.projectsRepository.getDependencies(projectId)
            : undefined;

        this.selectedNames.clear();
        for (const dependency of dependenciesResponse?.dependencies ?? []) {
            if (dependency.upgradeType !== "none") {
                this.selectedNames.add(dependency.name);
            }
        }
    };

    public deselectAll = (): void => {
        this.selectedNames.clear();
    };
}
