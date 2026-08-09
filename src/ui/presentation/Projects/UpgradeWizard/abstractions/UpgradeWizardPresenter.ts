import { createAbstraction } from "#shared/index.js";
import type { UpgradeSessionsGateway } from "../../../../features/UpgradeSessions/abstractions/UpgradeSessionsGateway.js";
import type { IChangelogResult } from "../../ProjectDetail/abstractions/ProjectDetailPresenter.js";
import type {
    IChangelogTrackingState,
    IStartChangelogTrackingInput
} from "../../../Shared/ChangelogTracker.js";

export interface IUpgradeWizardViewModel {
    loading: boolean;
    error: string | null;
    session: UpgradeSessionsGateway.SessionResponse | null;
    activeStep: UpgradeSessionsGateway.StepState | null;
    projectName: string;
    stepLogs: string[];
    branchTemplate: string;
    commitTemplate: string;
    prTitleTemplate: string;
    prBodyTemplate: string;
    changelogState: IChangelogTrackingState | null;
}

export interface IUpgradeWizardPresenter {
    get vm(): IUpgradeWizardViewModel;
    load: (projectId: string, preselected?: string[]) => Promise<void>;
    executeStep: (stepType: string, input: Record<string, unknown>) => Promise<void>;
    skipStep: (stepType: string) => Promise<void>;
    abort: () => Promise<void>;
    getChangelogs: (packageName: string, from: string, to: string) => Promise<IChangelogResult>;
    reResolveChangelogs: (
        packageName: string,
        from: string,
        to: string
    ) => Promise<IChangelogResult>;
    startChangelogTracking: (input: IStartChangelogTrackingInput) => void;
    stopChangelogTracking: () => void;
    dispose: () => void;
}

export const UpgradeWizardPresenter = createAbstraction<IUpgradeWizardPresenter>(
    "Ui/UpgradeWizardPresenter"
);

export namespace UpgradeWizardPresenter {
    export type Interface = IUpgradeWizardPresenter;
    export type ViewModel = IUpgradeWizardViewModel;
}
