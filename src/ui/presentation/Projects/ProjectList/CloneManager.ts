import { makeAutoObservable, runInAction } from "mobx";
import type { CloneProjectUseCase } from "../useCases/abstractions/CloneProjectUseCase.js";

interface ICloneManagerDependencies {
    cloneProjectUseCase: CloneProjectUseCase.Interface;
    getBrowsePath: () => string;
    onCloned: () => Promise<void>;
}

export class CloneManager {
    public url = "";
    public folderName = "";
    public loading = false;
    public error: string | null = null;

    public constructor(private readonly dependencies: ICloneManagerDependencies) {
        makeAutoObservable(this);
    }

    public setUrl = (url: string): void => {
        this.url = url;
        const match = url.match(/\/([^/]+?)(?:\.git)?$/);
        if (match) {
            this.folderName = match[1]!;
        }
    };

    public setFolderName = (name: string): void => {
        this.folderName = name;
    };

    public clone = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            await this.dependencies.cloneProjectUseCase.execute(
                this.url,
                this.dependencies.getBrowsePath(),
                this.folderName || undefined
            );
            runInAction(() => {
                this.loading = false;
                this.url = "";
                this.folderName = "";
            });
            await this.dependencies.onCloned();
        } catch (error) {
            runInAction(() => {
                this.loading = false;
                this.error = error instanceof Error ? error.message : "Failed to clone project";
            });
        }
    };
}
