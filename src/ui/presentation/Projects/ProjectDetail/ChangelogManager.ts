import { makeAutoObservable } from "mobx";
import { ChangelogTracker } from "../../Shared/ChangelogTracker.js";
import type {
    IChangelogTrackingState,
    IStartChangelogTrackingInput
} from "../../Shared/ChangelogTracker.js";
import type { ChangelogsGateway } from "../../../features/Changelogs/abstractions/ChangelogsGateway.js";
import type { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";

interface IChangelogManagerDependencies {
    changelogsGateway: ChangelogsGateway.Interface;
    eventBridge: EventBridge.Interface;
}

export class ChangelogManager {
    private readonly changelogsGateway: ChangelogsGateway.Interface;
    private readonly changelogTracker: ChangelogTracker;

    public constructor(dependencies: IChangelogManagerDependencies) {
        this.changelogsGateway = dependencies.changelogsGateway;
        this.changelogTracker = new ChangelogTracker(dependencies.eventBridge);

        makeAutoObservable(this);
    }

    public get trackingState(): IChangelogTrackingState | null {
        return this.changelogTracker.state;
    }

    public getChangelogs = async (
        packageName: string,
        from: string,
        to: string
    ): Promise<ChangelogsGateway.ChangelogResult> => {
        return this.changelogsGateway.getChangelogs(packageName, from, to);
    };

    public reResolveChangelogs = async (
        packageName: string,
        from: string,
        to: string
    ): Promise<ChangelogsGateway.ChangelogResult> => {
        return this.changelogsGateway.reResolveChangelogs(packageName, from, to);
    };

    public startTracking = (input: IStartChangelogTrackingInput): void => {
        this.changelogTracker.startTracking(input);
    };

    public stopTracking = (): void => {
        this.changelogTracker.stopTracking();
    };

    public dispose(): void {
        this.changelogTracker.dispose();
    }
}
