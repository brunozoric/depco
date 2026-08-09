import { makeAutoObservable, runInAction, computed } from "mobx";
import { BackupPresenter as Abstraction } from "./abstractions/BackupPresenter.js";
import type { BackupGateway } from "../../../features/Backup/abstractions/BackupGateway.js";
import { downloadBlob } from "#ui/infrastructure/Shared/download/downloadBlob.js";

function backupFilename(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `backup-${yyyy}-${mm}-${dd}.zip`;
}

class BackupPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private importResult: BackupGateway.ImportResult | null = null;

    public constructor() {
        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        return {
            loading: this.loading,
            error: this.error,
            importResult: this.importResult
        };
    }

    public exportBackup = async (): Promise<void> => {
        this.loading = true;
        this.error = null;

        try {
            const response = await fetch("/api/Projects/backup");
            if (!response.ok) {
                throw new Error(`Export failed: ${response.status}`);
            }
            const blob = await response.blob();
            downloadBlob(blob, backupFilename());
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to export backup";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public importBackup = async (file: File): Promise<void> => {
        this.loading = true;
        this.error = null;

        try {
            const response = await fetch("/api/Projects/backup", {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
                body: await file.arrayBuffer()
            });
            if (!response.ok) {
                throw new Error(`Import failed: ${response.status}`);
            }
            const result = (await response.json()) as BackupGateway.ImportResult;
            runInAction(() => {
                this.importResult = result;
            });
        } catch (err) {
            runInAction(() => {
                this.error = err instanceof Error ? err.message : "Failed to import backup";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public clearResult = (): void => {
        this.importResult = null;
    };
}

export const BackupPresenter = Abstraction.createImplementation({
    implementation: BackupPresenterImpl,
    dependencies: []
});
