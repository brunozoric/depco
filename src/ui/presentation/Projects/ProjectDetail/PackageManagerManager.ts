import { makeAutoObservable } from "mobx";
import type { ProjectDetailPresenter } from "./abstractions/ProjectDetailPresenter.js";
import type { ProjectsGateway } from "../../../features/Projects/abstractions/ProjectsGateway.js";
import type { UpdatePackageManagerUseCase } from "../../Upgrades/useCases/abstractions/UpdatePackageManagerUseCase.js";

interface IPackageManagerManagerDependencies {
    projectsGateway: ProjectsGateway.Interface;
    updatePackageManagerUseCase: UpdatePackageManagerUseCase.Interface;
    getProjectId: () => string | null;
}

export class PackageManagerManager {
    public updateVersion = "";

    private readonly projectsGateway: ProjectsGateway.Interface;
    private readonly updatePackageManagerUseCase: UpdatePackageManagerUseCase.Interface;
    private readonly getProjectId: () => string | null;

    public constructor(dependencies: IPackageManagerManagerDependencies) {
        this.projectsGateway = dependencies.projectsGateway;
        this.updatePackageManagerUseCase = dependencies.updatePackageManagerUseCase;
        this.getProjectId = dependencies.getProjectId;

        makeAutoObservable(this);
    }

    public setUpdateVersion = (version: string): void => {
        this.updateVersion = version;
    };

    public update = async (): Promise<void> => {
        const projectId = this.getProjectId();
        if (!projectId) {
            return;
        }
        await this.updatePackageManagerUseCase.execute(projectId, this.updateVersion);
    };

    public install = async (flags: string[] = []): Promise<void> => {
        const projectId = this.getProjectId();
        if (!projectId) {
            return;
        }
        await this.projectsGateway.install(projectId, flags);
    };

    public getInstallOptions = async (
        packageManager: string
    ): Promise<ProjectDetailPresenter.InstallFlagDefinition[]> => {
        return this.projectsGateway.getInstallOptions(packageManager);
    };
}
