import { makeAutoObservable, runInAction } from "mobx";
import type { SbomGateway } from "../../../features/Sbom/abstractions/SbomGateway.js";
import { downloadBlob } from "#ui/infrastructure/Shared/download/downloadBlob.js";

interface ISbomExportManagerDependencies {
    sbomGateway: SbomGateway.Interface;
    getProjectId: () => string | null;
}

export class SbomExportManager {
    public exporting = false;
    public error: string | null = null;

    public constructor(private readonly dependencies: ISbomExportManagerDependencies) {
        makeAutoObservable(this);
    }

    public export = async (format: string): Promise<void> => {
        const projectId = this.dependencies.getProjectId();
        if (!projectId) {
            return;
        }
        this.exporting = true;
        this.error = null;
        try {
            const response = await this.dependencies.sbomGateway.exportProject(projectId, format);
            downloadBlob(response.blob, response.filename);
        } catch (error) {
            runInAction(() => {
                this.error = error instanceof Error ? error.message : "SBOM export failed";
            });
        } finally {
            runInAction(() => {
                this.exporting = false;
            });
        }
    };
}
