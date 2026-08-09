import { computed, makeAutoObservable, runInAction } from "mobx";
import type { EventBridge } from "../../infrastructure/Events/abstractions/EventBridge.js";
import "../../infrastructure/Events/eventMap.js";
import { compareVersions } from "../../infrastructure/Shared/versionCompare.js";
import type { IChangelogEntry } from "#shared/changelog/types.js";

export interface IChangelogTrackingState {
    entries: IChangelogEntry[];
    resolving: boolean;
    resolvedCount: number;
    totalToResolve: number;
}

export interface IStartChangelogTrackingInput {
    packageName: string;
    entries: IChangelogEntry[];
    resolving: boolean;
}

export class ChangelogTracker {
    private trackingPackageName: string | null = null;
    private trackingEntries: IChangelogEntry[] = [];
    private trackingResolving = false;
    private trackingResolvedCount = 0;
    private trackingTotalToResolve = 0;

    private readonly handleChangelogResolved: EventBridge.Callback<"changelog:resolved">;
    private readonly handleChangelogJobStatus: EventBridge.Callback<"job:status">;

    public constructor(private readonly eventBridge: EventBridge.Interface) {
        makeAutoObservable(this, { state: computed });

        this.handleChangelogResolved = data => {
            if (
                this.trackingPackageName === null ||
                data.packageName !== this.trackingPackageName
            ) {
                return;
            }
            runInAction(() => {
                this.trackingResolvedCount++;
                const existing = this.trackingEntries.find(entry => entry.version === data.version);
                if (existing) {
                    this.trackingEntries = this.trackingEntries.map(entry =>
                        entry.version === data.version
                            ? { ...entry, content: data.content, source: data.source }
                            : entry
                    );
                } else {
                    this.trackingEntries = [
                        ...this.trackingEntries,
                        { version: data.version, content: data.content, source: data.source }
                    ].sort((a, b) => compareVersions(b.version, a.version));
                }
            });
        };

        this.handleChangelogJobStatus = data => {
            if (
                this.trackingPackageName === null ||
                data.type !== "changelog" ||
                data.referenceId !== this.trackingPackageName
            ) {
                return;
            }
            if (
                data.status === "completed" ||
                data.status === "failed" ||
                data.status === "cancelled" ||
                data.status === "interrupted"
            ) {
                runInAction(() => {
                    this.trackingResolving = false;
                });
            }
        };

        this.eventBridge.on("changelog:resolved", this.handleChangelogResolved);
        this.eventBridge.on("job:status", this.handleChangelogJobStatus);
    }

    public get state(): IChangelogTrackingState | null {
        if (this.trackingPackageName === null) {
            return null;
        }
        return {
            entries: this.trackingEntries,
            resolving: this.trackingResolving,
            resolvedCount: this.trackingResolvedCount,
            totalToResolve: this.trackingTotalToResolve
        };
    }

    public startTracking(input: IStartChangelogTrackingInput): void {
        this.trackingPackageName = input.packageName;
        this.trackingEntries = input.entries;
        this.trackingResolving = input.resolving;
        this.trackingResolvedCount = 0;
        this.trackingTotalToResolve = input.entries.filter(entry => entry.content === null).length;
    }

    public stopTracking(): void {
        this.trackingPackageName = null;
        this.trackingEntries = [];
        this.trackingResolving = false;
        this.trackingResolvedCount = 0;
        this.trackingTotalToResolve = 0;
    }

    public dispose(): void {
        this.eventBridge.off("changelog:resolved", this.handleChangelogResolved);
        this.eventBridge.off("job:status", this.handleChangelogJobStatus);
    }
}
