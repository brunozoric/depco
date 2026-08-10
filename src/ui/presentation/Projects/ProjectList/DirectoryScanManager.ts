import { makeAutoObservable, runInAction } from "mobx";
import type { FilesystemGateway } from "../../../features/Filesystem/abstractions/FilesystemGateway.js";
import type { ProjectListPresenter } from "./abstractions/ProjectListPresenter.js";

interface IDirectoryScanManagerDependencies {
    filesystemGateway: FilesystemGateway.Interface;
    getBrowsePath: () => string;
}

export class DirectoryScanManager {
    public results: ProjectListPresenter.BrowseItem[] = [];
    public loading = false;
    public summary: ProjectListPresenter.ScanSummary | null = null;
    public depth = 1;

    public constructor(private readonly dependencies: IDirectoryScanManagerDependencies) {
        makeAutoObservable(this);
    }

    public scan = async (): Promise<string | undefined> => {
        this.loading = true;
        try {
            const result = await this.dependencies.filesystemGateway.scan(
                this.dependencies.getBrowsePath(),
                this.depth
            );
            runInAction(() => {
                this.results = result.items;
                this.summary = {
                    scannedPath: result.scannedPath,
                    scannedCount: result.scannedCount,
                    filteredCount: result.filteredCount,
                    mode: result.mode
                };
            });
            return undefined;
        } catch (error) {
            return error instanceof Error ? error.message : "Failed to scan directory";
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public clear = (): void => {
        this.results = [];
        this.summary = null;
    };

    public setDepth = (depth: number): void => {
        this.depth = Math.max(1, Math.min(5, depth));
    };
}
