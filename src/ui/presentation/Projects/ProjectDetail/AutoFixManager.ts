import { makeAutoObservable, runInAction } from "mobx";
import type { AutoFixGateway } from "../../../features/AutoFix/abstractions/AutoFixGateway.js";
import type { ProjectDetailPresenter } from "./abstractions/ProjectDetailPresenter.js";

interface IAutoFixManagerDependencies {
    autoFixGateway: AutoFixGateway.Interface;
    getProjectId: () => string | null;
}

export class AutoFixManager {
    public settings: AutoFixGateway.Settings | null = null;
    public pullRequests: AutoFixGateway.PullRequest[] = [];
    public running = false;

    public constructor(private readonly dependencies: IAutoFixManagerDependencies) {
        makeAutoObservable(this);
    }

    public loadSettings = async (projectId: string): Promise<void> => {
        try {
            const settings = await this.dependencies.autoFixGateway.getSettings(projectId);
            runInAction(() => {
                this.settings = settings;
            });
        } catch {
            // Auto-fix settings fetch failure should not break the page
        }
    };

    public loadPullRequests = async (projectId: string): Promise<void> => {
        try {
            const response =
                await this.dependencies.autoFixGateway.getProjectPullRequests(projectId);
            runInAction(() => {
                this.pullRequests = response.items;
            });
        } catch {
            // Auto-fix PR fetch failure should not break the page
        }
    };

    public updateSettings = async (
        input: ProjectDetailPresenter.UpdateAutoFixSettingsInput
    ): Promise<void> => {
        const projectId = this.dependencies.getProjectId();
        if (!projectId) {
            return;
        }
        const settings = await this.dependencies.autoFixGateway.updateSettings(projectId, input);
        runInAction(() => {
            this.settings = settings;
        });
    };

    public generate = async (): Promise<void> => {
        const projectId = this.dependencies.getProjectId();
        if (!projectId) {
            return;
        }
        this.running = true;
        try {
            await this.dependencies.autoFixGateway.generate(projectId);
            await this.loadPullRequests(projectId);
        } finally {
            runInAction(() => {
                this.running = false;
            });
        }
    };
}
