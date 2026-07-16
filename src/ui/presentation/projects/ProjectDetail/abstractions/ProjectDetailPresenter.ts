import { createAbstraction } from "#shared/index.js";
import type { IInstallFlagDefinition } from "#shared/install/types.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import type { IChangelogEntry } from "#shared/changelog/types.js";
import type {
    IChangelogTrackingState,
    IStartChangelogTrackingInput
} from "../../../shared/ChangelogTracker.js";

export interface IProjectDetailProjectViewModel {
    id: string;
    name: string;
    path: string;
    pmVersion: string | null;
    packageManager: string | null;
}

export interface IProjectDetailSecurityViewModel {
    passes: boolean;
    checks: Record<string, boolean>;
}

export interface IProjectDetailScanProgressViewModel {
    packageName: string;
    current: number;
    total: number;
}

export interface IProjectDetailDependencyViewModel {
    name: string;
    currentVersion: string;
    latestInRange: string;
    latestVersion: string;
    type: string;
    upgradeType: "patch" | "minor" | "major" | "none";
    selected: boolean;
    vulnerabilityCount: number;
    vulnerabilityMaxSeverity: VulnerabilitySeverity | null;
    license: string | null;
    licenseRiskTier: string | null;
    dependencyKind: string;
    registryResolved: boolean;
}

export interface IChangelogResult {
    entries: IChangelogEntry[];
    resolving: boolean;
}

export type UpgradeFilter = "all" | "upgradeable" | "up-to-date";

export type ScheduleSource = "project" | "default";

export interface IProjectDetailScheduleViewModel {
    interval: string;
    source: ScheduleSource;
    globalDefault: string;
}

export interface IAutoFixSettingsViewModel {
    enabled: boolean;
    upgradeTypes: string[];
    groupingStrategy: string;
    branchPrefix: string;
}

export interface IAutoFixPullRequestViewModel {
    id: string;
    packageNames: string[];
    fromVersions: Record<string, string>;
    toVersions: Record<string, string>;
    upgradeType: string;
    branchName: string;
    prUrl: string | null;
    prNumber: number | null;
    status: string;
    licenseWarnings: string[];
}

export interface IUpdateAutoFixSettingsInput {
    enabled?: boolean;
    upgradeTypes?: string[];
    groupingStrategy?: string;
    branchPrefix?: string;
}

export interface ITeamOption {
    id: string;
    name: string;
    color: string;
}

export interface IProjectDetailViewModel {
    loading: boolean;
    scanning: boolean;
    scanProgress: IProjectDetailScanProgressViewModel | null;
    scanError: string | null;
    scanWarning: string | null;
    project: IProjectDetailProjectViewModel | null;
    security: IProjectDetailSecurityViewModel | null;
    dependencies: IProjectDetailDependencyViewModel[];
    upgradeFilter: UpgradeFilter;
    totalDependencyCount: number;
    canUpgrade: boolean;
    selectedCount: number;
    packageManagerUpdateVersion: string;
    schedule: IProjectDetailScheduleViewModel | null;
    autoFixSettings: IAutoFixSettingsViewModel | null;
    autoFixPullRequests: IAutoFixPullRequestViewModel[];
    autoFixRunning: boolean;
    exportingSbom: boolean;
    sbomExportError: string | null;
    projectTeamIds: string[];
    availableTeams: ITeamOption[];
    changelogState: IChangelogTrackingState | null;
}

export interface IProjectDetailPresenter {
    get vm(): IProjectDetailViewModel;
    load: (projectId: string) => Promise<void>;
    scan: (force?: boolean) => Promise<void>;
    togglePackage: (name: string) => void;
    selectAll: () => void;
    deselectAll: () => void;
    setUpgradeFilter: (filter: UpgradeFilter) => void;
    refreshTransient: () => Promise<void>;
    updatePackageManager: () => Promise<void>;
    setPackageManagerUpdateVersion: (version: string) => void;
    install: (flags?: string[]) => Promise<void>;
    getInstallOptions: (packageManager: string) => Promise<IInstallFlagDefinition[]>;
    getChangelogs: (packageName: string, from: string, to: string) => Promise<IChangelogResult>;
    reResolveChangelogs: (
        packageName: string,
        from: string,
        to: string
    ) => Promise<IChangelogResult>;
    updateSchedule: (interval: string) => Promise<void>;
    resetSchedule: () => Promise<void>;
    updateAutoFixSettings: (input: IUpdateAutoFixSettingsInput) => Promise<void>;
    generateAutoFixPrs: () => Promise<void>;
    exportSbom: (format: string) => Promise<void>;
    setProjectTeams: (teamIds: string[]) => Promise<void>;
    startChangelogTracking: (input: IStartChangelogTrackingInput) => void;
    stopChangelogTracking: () => void;
    dispose: () => void;
}

export const ProjectDetailPresenter = createAbstraction<IProjectDetailPresenter>(
    "Ui/ProjectDetailPresenter"
);

export namespace ProjectDetailPresenter {
    export type Interface = IProjectDetailPresenter;
    export type ViewModel = IProjectDetailViewModel;
    export type ProjectViewModel = IProjectDetailProjectViewModel;
    export type SecurityViewModel = IProjectDetailSecurityViewModel;
    export type DependencyViewModel = IProjectDetailDependencyViewModel;
    export type ScanProgressViewModel = IProjectDetailScanProgressViewModel;
    export type InstallFlagDefinition = IInstallFlagDefinition;
    export type ChangelogEntry = IChangelogEntry;
    export type ChangelogResult = IChangelogResult;
    export type Filter = UpgradeFilter;
    export type ScheduleViewModel = IProjectDetailScheduleViewModel;
    export type Source = ScheduleSource;
    export type AutoFixSettingsViewModel = IAutoFixSettingsViewModel;
    export type AutoFixPullRequestViewModel = IAutoFixPullRequestViewModel;
    export type UpdateAutoFixSettingsInput = IUpdateAutoFixSettingsInput;
    export type TeamOption = ITeamOption;
    export type ChangelogTrackingState = IChangelogTrackingState;
    export type StartChangelogTrackingInput = IStartChangelogTrackingInput;
}
