import { computed, makeAutoObservable, runInAction } from "mobx";
import type { UpgradeFilter } from "./abstractions/ProjectDetailPresenter.js";
import { ProjectDetailPresenter as Abstraction } from "./abstractions/ProjectDetailPresenter.js";
import { LoadProjectsUseCase } from "../useCases/abstractions/LoadProjectsUseCase.js";
import { ScanProjectUseCase } from "../useCases/abstractions/ScanProjectUseCase.js";
import { RefreshTransientUseCase } from "../../Upgrades/useCases/abstractions/RefreshTransientUseCase.js";
import { UpdatePackageManagerUseCase } from "../../Upgrades/useCases/abstractions/UpdatePackageManagerUseCase.js";
import { ProjectsGateway } from "../../../features/Projects/abstractions/ProjectsGateway.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { EventBridge } from "../../../infrastructure/Events/abstractions/EventBridge.js";
import "../../../infrastructure/Events/eventMap.js";
import { ChangelogTracker } from "../../Shared/ChangelogTracker.js";
import type { IStartChangelogTrackingInput } from "../../Shared/ChangelogTracker.js";
import { ScanSchedulesRepository } from "../../../features/ScanSchedules/abstractions/ScanSchedulesRepository.js";
import { LoadScanSchedulesUseCase } from "../../ScanSchedules/useCases/abstractions/LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleUseCase } from "../../ScanSchedules/useCases/abstractions/UpdateScanScheduleUseCase.js";
import { ResetScanScheduleUseCase } from "../../ScanSchedules/useCases/abstractions/ResetScanScheduleUseCase.js";
import { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import { VULNERABILITY_SEVERITIES } from "#shared/vulnerabilities/types.js";
import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";
import { LicensesGateway } from "../../../features/Licenses/abstractions/LicensesGateway.js";
import { AutoFixGateway } from "../../../features/AutoFix/abstractions/AutoFixGateway.js";
import { SbomGateway } from "../../../features/Sbom/abstractions/SbomGateway.js";
import { TeamsGateway } from "../../../features/Teams/abstractions/TeamsGateway.js";
import { TeamListService } from "../../../features/TeamFilter/abstractions/TeamListService.js";
import { UrlFilterService } from "../../../features/UrlFilter/abstractions/UrlFilterService.js";
import { downloadBlob } from "#ui/infrastructure/Shared/download/downloadBlob.js";
import { getProjectDependenciesRoute } from "#shared/routes/projects.js";
import type { z } from "zod";

const DEFAULT_PAGE_SIZE = 25;

const DEPENDENCY_FILTER_SCHEMA = getProjectDependenciesRoute.querystring as NonNullable<
    typeof getProjectDependenciesRoute.querystring
> &
    z.ZodObject<z.ZodRawShape>;

interface LicenseData {
    licenseName: string;
    riskTier: string;
}

interface ScanState {
    scanning: boolean;
    progress: Abstraction.ScanProgressViewModel | null;
    error: string | null;
}

class ProjectDetailPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private readonly scanStates = new Map<string, ScanState>();
    private currentProjectId: string | null = null;
    private readonly selectedNames = new Set<string>();
    private packageManagerUpdateVersionValue = "";
    private scanWarning: string | null = null;
    private upgradeFilterValue: UpgradeFilter = "all";
    private vulnerabilitiesByPackage = new Map<
        string,
        { count: number; maxSeverity: VulnerabilitySeverity }
    >();
    private licenseByPackage = new Map<string, LicenseData>();
    private currentAutoFixSettings: AutoFixGateway.Settings | null = null;
    private autoFixPullRequestItems: AutoFixGateway.PullRequest[] = [];
    private autoFixRunning = false;
    private exportingSbom = false;
    private sbomExportError: string | null = null;
    private projectTeamIdValues: string[] = [];

    private readonly changelogTracker: ChangelogTracker;
    private readonly disposeUrlListener: () => void;

    private readonly handleScanProgress: EventBridge.Callback<"scan:progress">;
    private readonly handleScanComplete: EventBridge.Callback<"scan:complete">;
    private readonly handleScanFailed: EventBridge.Callback<"scan:failed">;
    private readonly handleInstallComplete: EventBridge.Callback<"install:complete">;
    private readonly handleTransitiveResolveComplete: EventBridge.Callback<"transitive-resolve:complete">;

    public constructor(
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly scanProjectUseCase: ScanProjectUseCase.Interface,
        private readonly refreshTransientUseCase: RefreshTransientUseCase.Interface,
        private readonly updatePackageManagerUseCase: UpdatePackageManagerUseCase.Interface,
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly eventBridge: EventBridge.Interface,
        private readonly scanSchedulesRepository: ScanSchedulesRepository.Interface,
        private readonly loadScanSchedulesUseCase: LoadScanSchedulesUseCase.Interface,
        private readonly updateScanScheduleUseCase: UpdateScanScheduleUseCase.Interface,
        private readonly resetScanScheduleUseCase: ResetScanScheduleUseCase.Interface,
        private readonly vulnerabilitiesGateway: VulnerabilitiesGateway.Interface,
        private readonly licensesGateway: LicensesGateway.Interface,
        private readonly autoFixGateway: AutoFixGateway.Interface,
        private readonly sbomGateway: SbomGateway.Interface,
        private readonly teamsGateway: TeamsGateway.Interface,
        private readonly teamListService: TeamListService.Interface,
        private readonly urlFilterService: UrlFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
        this.changelogTracker = new ChangelogTracker(this.eventBridge);

        this.handleScanProgress = data => {
            runInAction(() => {
                this.scanStates.set(data.projectId, {
                    scanning: true,
                    progress: {
                        packageName: data.packageName,
                        current: data.current,
                        total: data.total
                    },
                    error: null
                });
            });
        };

        this.handleScanComplete = data => {
            runInAction(() => {
                this.scanWarning = data.warning ?? null;
            });
            void this.finishScan(data.projectId);
        };

        this.handleScanFailed = data => {
            runInAction(() => {
                this.scanStates.set(data.projectId, {
                    scanning: false,
                    progress: null,
                    error: data.error
                });
            });
        };

        this.handleInstallComplete = data => {
            if (data.projectId === this.currentProjectId) {
                void this.load(data.projectId);
            }
        };

        this.handleTransitiveResolveComplete = data => {
            if (data.projectId === this.currentProjectId) {
                void this.loadDependencies(data.projectId);
            }
        };

        this.eventBridge.on("scan:progress", this.handleScanProgress);
        this.eventBridge.on("scan:complete", this.handleScanComplete);
        this.eventBridge.on("scan:failed", this.handleScanFailed);
        this.eventBridge.on("install:complete", this.handleInstallComplete);
        this.eventBridge.on("transitive-resolve:complete", this.handleTransitiveResolveComplete);

        this.disposeUrlListener = this.urlFilterService.onChange(() => {
            if (this.currentProjectId) {
                void this.loadDependencies(this.currentProjectId);
            }
        });
    }

    public get vm(): Abstraction.ViewModel {
        const project = this.currentProjectId
            ? this.projectsRepository.getProject(this.currentProjectId)
            : undefined;

        const dependenciesResponse = this.currentProjectId
            ? this.projectsRepository.getDependencies(this.currentProjectId)
            : undefined;

        const security = this.currentProjectId
            ? this.projectsRepository.getSecurityStatus(this.currentProjectId)
            : undefined;

        const scanState = this.currentProjectId
            ? this.scanStates.get(this.currentProjectId)
            : undefined;

        const schedule = this.currentProjectId
            ? this.scanSchedulesRepository.getSchedule(this.currentProjectId)
            : undefined;

        const urlFilters = this.urlFilterService.read(DEPENDENCY_FILTER_SCHEMA);
        const pageSize = urlFilters.pageSize ?? DEFAULT_PAGE_SIZE;
        const totalCount = dependenciesResponse?.total ?? 0;

        const dependencies = (dependenciesResponse?.dependencies ?? []).map(
            (dependency): Abstraction.DependencyViewModel => {
                const vulnerabilityData = this.vulnerabilitiesByPackage.get(dependency.name);
                const licenseData = this.licenseByPackage.get(dependency.name);
                return {
                    name: dependency.name,
                    currentVersion: dependency.currentVersion,
                    latestInRange: dependency.latestInRange,
                    latestVersion: dependency.latestVersion,
                    type: dependency.type,
                    upgradeType: dependency.upgradeType,
                    selected: this.selectedNames.has(dependency.name),
                    vulnerabilityCount: vulnerabilityData?.count ?? 0,
                    vulnerabilityMaxSeverity: vulnerabilityData?.maxSeverity ?? null,
                    license: licenseData?.licenseName ?? null,
                    licenseRiskTier: licenseData?.riskTier ?? null,
                    dependencyKind: dependency.dependencyKind,
                    registryResolved: dependency.registryResolved
                };
            }
        );

        return {
            loading: this.loading,
            scanning: scanState?.scanning ?? false,
            scanProgress: scanState?.progress ?? null,
            scanError: scanState?.error ?? null,
            scanWarning: this.scanWarning,
            project: project
                ? {
                      id: project.id,
                      name: project.name,
                      path: project.path,
                      pmVersion: project.pmVersion,
                      packageManager: project.packageManager ?? null
                  }
                : null,
            security: security
                ? {
                      passes: security.passes,
                      checks: security.checks
                  }
                : null,
            dependencies,
            upgradeFilter: this.upgradeFilterValue,
            totalDependencyCount: totalCount,
            search: urlFilters.search ?? "",
            page: urlFilters.page ?? 1,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
            canUpgrade: this.selectedNames.size > 0,
            selectedCount: this.selectedNames.size,
            packageManagerUpdateVersion: this.packageManagerUpdateVersionValue,
            schedule: schedule
                ? {
                      interval: schedule.interval,
                      source: schedule.source,
                      globalDefault: this.scanSchedulesRepository.getGlobalDefault()
                  }
                : null,
            autoFixSettings: this.currentAutoFixSettings
                ? {
                      enabled: this.currentAutoFixSettings.enabled,
                      upgradeTypes: this.currentAutoFixSettings.upgradeTypes,
                      groupingStrategy: this.currentAutoFixSettings.groupingStrategy,
                      branchPrefix: this.currentAutoFixSettings.branchPrefix
                  }
                : null,
            autoFixPullRequests: this.autoFixPullRequestItems.map(
                (pullRequest): Abstraction.AutoFixPullRequestViewModel => ({
                    id: pullRequest.id,
                    packageNames: pullRequest.packageNames,
                    fromVersions: pullRequest.fromVersions,
                    toVersions: pullRequest.toVersions,
                    upgradeType: pullRequest.upgradeType,
                    branchName: pullRequest.branchName,
                    prUrl: pullRequest.prUrl,
                    prNumber: pullRequest.prNumber,
                    status: pullRequest.status,
                    licenseWarnings: pullRequest.licenseWarnings
                })
            ),
            autoFixRunning: this.autoFixRunning,
            exportingSbom: this.exportingSbom,
            sbomExportError: this.sbomExportError,
            projectTeamIds: this.projectTeamIdValues,
            availableTeams: this.teamListService.getTeams(),
            changelogState: this.changelogTracker.state
        };
    }

    public load = async (projectId: string): Promise<void> => {
        this.loading = true;
        this.currentProjectId = projectId;
        try {
            await Promise.all([
                this.loadProjectsUseCase.execute(),
                this.loadSecurity(projectId),
                this.loadDependencies(projectId),
                this.loadScanSchedulesUseCase.execute(),
                this.loadVulnerabilities(projectId),
                this.loadLicenses(projectId),
                this.loadAutoFixSettings(projectId),
                this.loadAutoFixPullRequests(projectId),
                this.loadProjectTeams(projectId),
                this.loadAvailableTeams()
            ]);
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public scan = async (force?: boolean): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }

        const projectId = this.currentProjectId;
        this.scanStates.set(projectId, { scanning: true, progress: null, error: null });
        this.scanWarning = null;
        try {
            await this.scanProjectUseCase.execute(projectId, force);
        } catch (error) {
            runInAction(() => {
                this.scanStates.set(projectId, { scanning: false, progress: null, error: null });
            });
            throw error;
        }
    };

    private finishScan = async (projectId: string): Promise<void> => {
        await Promise.all([this.loadDependencies(projectId), this.loadSecurity(projectId)]);
        runInAction(() => {
            this.scanStates.set(projectId, { scanning: false, progress: null, error: null });
        });
    };

    private loadDependencies = async (projectId: string): Promise<void> => {
        const urlFilters = this.urlFilterService.read(DEPENDENCY_FILTER_SCHEMA);
        const response = await this.projectsGateway.getDependencies(projectId, {
            ...urlFilters,
            pageSize: urlFilters.pageSize ?? DEFAULT_PAGE_SIZE
        });
        this.projectsRepository.setDependencies(projectId, response);
    };

    private loadSecurity = async (projectId: string): Promise<void> => {
        const status = await this.projectsGateway.getSecurity(projectId);
        this.projectsRepository.setSecurityStatus(projectId, status);
    };

    private loadVulnerabilities = async (projectId: string): Promise<void> => {
        try {
            const response = await this.vulnerabilitiesGateway.getByProject(projectId);
            const grouped = new Map<
                string,
                { count: number; maxSeverity: VulnerabilitySeverity }
            >();
            for (const vulnerability of response.items) {
                const existing = grouped.get(vulnerability.packageName);
                if (existing) {
                    existing.count++;
                    if (
                        VULNERABILITY_SEVERITIES.indexOf(vulnerability.severity) <
                        VULNERABILITY_SEVERITIES.indexOf(existing.maxSeverity)
                    ) {
                        existing.maxSeverity = vulnerability.severity;
                    }
                } else {
                    grouped.set(vulnerability.packageName, {
                        count: 1,
                        maxSeverity: vulnerability.severity
                    });
                }
            }
            runInAction(() => {
                this.vulnerabilitiesByPackage = grouped;
            });
        } catch {
            // Vulnerability fetch failure should not break the page
        }
    };

    private loadLicenses = async (projectId: string): Promise<void> => {
        try {
            const response = await this.licensesGateway.getByProject(projectId);
            const grouped = new Map<string, LicenseData>();
            for (const license of response.items) {
                grouped.set(license.packageName, {
                    licenseName: license.licenseName,
                    riskTier: license.riskTier
                });
            }
            runInAction(() => {
                this.licenseByPackage = grouped;
            });
        } catch {
            // License fetch failure should not break the page
        }
    };

    private loadAutoFixSettings = async (projectId: string): Promise<void> => {
        try {
            const settings = await this.autoFixGateway.getSettings(projectId);
            runInAction(() => {
                this.currentAutoFixSettings = settings;
            });
        } catch {
            // Auto-fix settings fetch failure should not break the page
        }
    };

    private loadAutoFixPullRequests = async (projectId: string): Promise<void> => {
        try {
            const response = await this.autoFixGateway.getProjectPullRequests(projectId);
            runInAction(() => {
                this.autoFixPullRequestItems = response.items;
            });
        } catch {
            // Auto-fix PR fetch failure should not break the page
        }
    };

    private loadProjectTeams = async (projectId: string): Promise<void> => {
        try {
            const response = await this.teamsGateway.getProjectTeams(projectId);
            runInAction(() => {
                this.projectTeamIdValues = response.items.map(team => team.id);
            });
        } catch {
            // Project teams fetch failure should not break the page
        }
    };

    private loadAvailableTeams = async (): Promise<void> => {
        if (this.teamListService.getTeams().length === 0) {
            await this.teamListService.loadTeams();
        }
    };

    public togglePackage = (name: string): void => {
        if (this.selectedNames.has(name)) {
            this.selectedNames.delete(name);
        } else {
            this.selectedNames.add(name);
        }
    };

    public selectAll = (): void => {
        const dependenciesResponse = this.currentProjectId
            ? this.projectsRepository.getDependencies(this.currentProjectId)
            : undefined;

        this.selectedNames.clear();
        for (const dependency of dependenciesResponse?.dependencies ?? []) {
            if (dependency.upgradeType !== "none") {
                this.selectedNames.add(dependency.name);
            }
        }
    };

    public deselectAll = (): void => {
        this.selectedNames.clear();
    };

    public setUpgradeFilter = (filter: UpgradeFilter): void => {
        this.upgradeFilterValue = filter;
    };

    public setSearch = (value: string): void => {
        this.urlFilterService.update(DEPENDENCY_FILTER_SCHEMA, {
            search: value || null,
            page: null
        });
    };

    public setPage = (page: number): void => {
        this.urlFilterService.update(DEPENDENCY_FILTER_SCHEMA, {
            page: page > 1 ? String(page) : null
        });
    };

    public refreshTransient = async (): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }

        await this.refreshTransientUseCase.execute(this.currentProjectId);
    };

    public updatePackageManager = async (): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }

        await this.updatePackageManagerUseCase.execute(
            this.currentProjectId,
            this.packageManagerUpdateVersionValue
        );
    };

    public setPackageManagerUpdateVersion = (version: string): void => {
        this.packageManagerUpdateVersionValue = version;
    };

    public install = async (flags: string[] = []): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        await this.projectsGateway.install(this.currentProjectId, flags);
    };

    public getInstallOptions = async (
        packageManager: string
    ): Promise<Abstraction.InstallFlagDefinition[]> => {
        return this.projectsGateway.getInstallOptions(packageManager);
    };

    public getChangelogs = async (
        packageName: string,
        from: string,
        to: string
    ): Promise<Abstraction.ChangelogResult> => {
        return this.projectsGateway.getChangelogs(packageName, from, to);
    };

    public reResolveChangelogs = async (
        packageName: string,
        from: string,
        to: string
    ): Promise<Abstraction.ChangelogResult> => {
        return this.projectsGateway.reResolveChangelogs(packageName, from, to);
    };

    public updateSchedule = async (interval: string): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        await this.updateScanScheduleUseCase.execute(this.currentProjectId, interval);
    };

    public resetSchedule = async (): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        await this.resetScanScheduleUseCase.execute(this.currentProjectId);
    };

    public updateAutoFixSettings = async (
        input: Abstraction.UpdateAutoFixSettingsInput
    ): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        const settings = await this.autoFixGateway.updateSettings(this.currentProjectId, input);
        runInAction(() => {
            this.currentAutoFixSettings = settings;
        });
    };

    public generateAutoFixPrs = async (): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        const projectId = this.currentProjectId;
        this.autoFixRunning = true;
        try {
            await this.autoFixGateway.generate(projectId);
            await this.loadAutoFixPullRequests(projectId);
        } finally {
            runInAction(() => {
                this.autoFixRunning = false;
            });
        }
    };

    public setProjectTeams = async (teamIds: string[]): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        const projectId = this.currentProjectId;
        await this.teamsGateway.setProjectTeams(projectId, teamIds);
        await this.loadProjectTeams(projectId);
    };

    public startChangelogTracking = (input: IStartChangelogTrackingInput): void => {
        this.changelogTracker.startTracking(input);
    };

    public stopChangelogTracking = (): void => {
        this.changelogTracker.stopTracking();
    };

    public dispose = (): void => {
        this.changelogTracker.dispose();
        this.disposeUrlListener();
        this.eventBridge.off("scan:progress", this.handleScanProgress);
        this.eventBridge.off("scan:complete", this.handleScanComplete);
        this.eventBridge.off("scan:failed", this.handleScanFailed);
        this.eventBridge.off("install:complete", this.handleInstallComplete);
        this.eventBridge.off("transitive-resolve:complete", this.handleTransitiveResolveComplete);
    };

    public exportSbom = async (format: string): Promise<void> => {
        if (!this.currentProjectId) {
            return;
        }
        const projectId = this.currentProjectId;
        this.exportingSbom = true;
        this.sbomExportError = null;
        try {
            const response = await this.sbomGateway.exportProject(projectId, format);
            downloadBlob(response.blob, response.filename);
        } catch (error) {
            runInAction(() => {
                this.sbomExportError =
                    error instanceof Error ? error.message : "SBOM export failed";
            });
        } finally {
            runInAction(() => {
                this.exportingSbom = false;
            });
        }
    };
}

export const ProjectDetailPresenter = Abstraction.createImplementation({
    implementation: ProjectDetailPresenterImpl,
    dependencies: [
        LoadProjectsUseCase,
        ScanProjectUseCase,
        RefreshTransientUseCase,
        UpdatePackageManagerUseCase,
        ProjectsGateway,
        ProjectsRepository,
        EventBridge,
        ScanSchedulesRepository,
        LoadScanSchedulesUseCase,
        UpdateScanScheduleUseCase,
        ResetScanScheduleUseCase,
        VulnerabilitiesGateway,
        LicensesGateway,
        AutoFixGateway,
        SbomGateway,
        TeamsGateway,
        TeamListService,
        UrlFilterService
    ]
});
