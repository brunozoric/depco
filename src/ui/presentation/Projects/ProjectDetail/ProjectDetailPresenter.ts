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
import { LicensesGateway } from "../../../features/Licenses/abstractions/LicensesGateway.js";
import { AutoFixGateway } from "../../../features/AutoFix/abstractions/AutoFixGateway.js";
import { SbomGateway } from "../../../features/Sbom/abstractions/SbomGateway.js";
import { TeamsGateway } from "../../../features/Teams/abstractions/TeamsGateway.js";
import { TeamListService } from "../../../features/TeamFilter/abstractions/TeamListService.js";
import { UrlFilterService } from "../../../features/UrlFilter/abstractions/UrlFilterService.js";
import { EnginesGateway } from "../../../features/Engines/abstractions/EnginesGateway.js";
import { EnginesRepository } from "../../../features/Engines/abstractions/EnginesRepository.js";
import { getProjectDependenciesRoute } from "#shared/routes/projects.js";
import type { z } from "zod";
import { AutoFixManager } from "./AutoFixManager.js";
import { SbomExportManager } from "./SbomExportManager.js";
import { DependencySelectionManager } from "./DependencySelectionManager.js";
import { ScanManager } from "./ScanManager.js";
import { PackageOverlayLoader } from "./PackageOverlayLoader.js";

const DEFAULT_PAGE_SIZE = 25;

const ENGINE_STATUS_SORT_PRIORITY: Record<string, number> = {
    eol: 0,
    maintenance: 1,
    unknown: 2,
    "active-lts": 3,
    current: 4
};

const DEPENDENCY_FILTER_SCHEMA = getProjectDependenciesRoute.querystring as NonNullable<
    typeof getProjectDependenciesRoute.querystring
> &
    z.ZodObject<z.ZodRawShape>;

class ProjectDetailPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private currentProjectId: string | null = null;
    private packageManagerUpdateVersionValue = "";
    private upgradeFilterValue: UpgradeFilter = "all";
    private projectTeamIdValues: string[] = [];
    private showMaintenanceValue = true;

    private readonly autoFixManager: AutoFixManager;
    private readonly sbomExportManager: SbomExportManager;
    private readonly selectionManager: DependencySelectionManager;
    private readonly scanManager: ScanManager;
    private readonly overlayLoader: PackageOverlayLoader;

    private readonly changelogTracker: ChangelogTracker;
    private readonly disposeUrlListener: () => void;

    private readonly handleInstallComplete: EventBridge.Callback<"install:complete">;
    private readonly handleTransitiveResolveComplete: EventBridge.Callback<"transitive-resolve:complete">;
    private readonly handleEngineScanComplete: EventBridge.Callback<"engine-scan:complete">;

    public constructor(
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        scanProjectUseCase: ScanProjectUseCase.Interface,
        private readonly refreshTransientUseCase: RefreshTransientUseCase.Interface,
        private readonly updatePackageManagerUseCase: UpdatePackageManagerUseCase.Interface,
        private readonly projectsGateway: ProjectsGateway.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly eventBridge: EventBridge.Interface,
        private readonly scanSchedulesRepository: ScanSchedulesRepository.Interface,
        private readonly loadScanSchedulesUseCase: LoadScanSchedulesUseCase.Interface,
        private readonly updateScanScheduleUseCase: UpdateScanScheduleUseCase.Interface,
        private readonly resetScanScheduleUseCase: ResetScanScheduleUseCase.Interface,
        vulnerabilitiesGateway: VulnerabilitiesGateway.Interface,
        licensesGateway: LicensesGateway.Interface,
        autoFixGateway: AutoFixGateway.Interface,
        sbomGateway: SbomGateway.Interface,
        private readonly teamsGateway: TeamsGateway.Interface,
        private readonly teamListService: TeamListService.Interface,
        private readonly urlFilterService: UrlFilterService.Interface,
        private readonly enginesGateway: EnginesGateway.Interface,
        private readonly enginesRepository: EnginesRepository.Interface
    ) {
        const getProjectId = (): string | null => this.currentProjectId;

        this.autoFixManager = new AutoFixManager({ autoFixGateway, getProjectId });
        this.sbomExportManager = new SbomExportManager({ sbomGateway, getProjectId });
        this.selectionManager = new DependencySelectionManager({
            projectsRepository: this.projectsRepository,
            getProjectId
        });
        this.scanManager = new ScanManager({
            scanProjectUseCase,
            eventBridge: this.eventBridge,
            getProjectId,
            onScanComplete: async projectId => {
                await Promise.all([this.loadDependencies(projectId), this.loadSecurity(projectId)]);
            }
        });
        this.overlayLoader = new PackageOverlayLoader({ vulnerabilitiesGateway, licensesGateway });

        makeAutoObservable(this, { vm: computed });
        this.changelogTracker = new ChangelogTracker(this.eventBridge);

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

        this.handleEngineScanComplete = data => {
            if (data.projectId === this.currentProjectId) {
                void this.loadEngineData(data.projectId);
            }
        };

        this.eventBridge.on("install:complete", this.handleInstallComplete);
        this.eventBridge.on("transitive-resolve:complete", this.handleTransitiveResolveComplete);
        this.eventBridge.on("engine-scan:complete", this.handleEngineScanComplete);

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
            ? this.scanManager.getState(this.currentProjectId)
            : undefined;

        const schedule = this.currentProjectId
            ? this.scanSchedulesRepository.getSchedule(this.currentProjectId)
            : undefined;

        const urlFilters = this.urlFilterService.read(DEPENDENCY_FILTER_SCHEMA);
        const pageSize = urlFilters.pageSize ?? DEFAULT_PAGE_SIZE;
        const totalCount = dependenciesResponse?.total ?? 0;

        const dependencies = (dependenciesResponse?.dependencies ?? []).map(
            (dependency): Abstraction.DependencyViewModel => {
                const vulnerabilityData = this.overlayLoader.vulnerabilitiesByPackage.get(
                    dependency.name
                );
                const licenseData = this.overlayLoader.licenseByPackage.get(dependency.name);
                return {
                    name: dependency.name,
                    currentVersion: dependency.currentVersion,
                    latestInRange: dependency.latestInRange,
                    latestVersion: dependency.latestVersion,
                    type: dependency.type,
                    upgradeType: dependency.upgradeType,
                    selected: this.selectionManager.selectedNames.has(dependency.name),
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
            scanWarning: this.scanManager.scanWarning,
            project: project
                ? {
                      id: project.id,
                      name: project.name,
                      path: project.path,
                      pmVersion: project.pmVersion,
                      packageManager: project.packageManager ?? null
                  }
                : null,
            security: security ? { passes: security.passes, checks: security.checks } : null,
            dependencies,
            upgradeFilter: this.upgradeFilterValue,
            totalDependencyCount: totalCount,
            search: urlFilters.search ?? "",
            page: urlFilters.page ?? 1,
            pageSize,
            totalPages: Math.ceil(totalCount / pageSize),
            canUpgrade: this.selectionManager.selectedNames.size > 0,
            selectedCount: this.selectionManager.selectedNames.size,
            packageManagerUpdateVersion: this.packageManagerUpdateVersionValue,
            schedule: schedule
                ? {
                      interval: schedule.interval,
                      source: schedule.source,
                      globalDefault: this.scanSchedulesRepository.getGlobalDefault()
                  }
                : null,
            autoFixSettings: this.autoFixManager.settings
                ? {
                      enabled: this.autoFixManager.settings.enabled,
                      upgradeTypes: this.autoFixManager.settings.upgradeTypes,
                      groupingStrategy: this.autoFixManager.settings.groupingStrategy,
                      branchPrefix: this.autoFixManager.settings.branchPrefix
                  }
                : null,
            autoFixPullRequests: this.autoFixManager.pullRequests.map(
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
            autoFixRunning: this.autoFixManager.running,
            exportingSbom: this.sbomExportManager.exporting,
            sbomExportError: this.sbomExportManager.error,
            projectTeamIds: this.projectTeamIdValues,
            availableTeams: this.teamListService.getTeams(),
            changelogState: this.changelogTracker.state,
            engineData: this.buildEngineDataViewModel(),
            showMaintenance: this.showMaintenanceValue
        };
    }

    private buildEngineDataViewModel(): Abstraction.EngineDataViewModel | null {
        if (!this.currentProjectId) {
            return null;
        }

        const checks = this.enginesRepository.getChecks();
        const rootCheck = checks.find(check => check.packageName === "");
        if (!rootCheck) {
            return null;
        }

        const findings = checks
            .filter(check => check.packageName !== "")
            .map((check): Abstraction.EngineFindingViewModel => ({
                packageName: check.packageName,
                enginesNode: check.enginesNode,
                status: check.status,
                eolDate: check.eolDate
            }))
            .sort(
                (a, b) =>
                    (ENGINE_STATUS_SORT_PRIORITY[a.status] ?? 99) -
                    (ENGINE_STATUS_SORT_PRIORITY[b.status] ?? 99)
            );

        const projectSummary = this.enginesRepository
            .getSummary()
            ?.projectSummaries.find(summary => summary.projectId === this.currentProjectId);

        return {
            rootStatus: rootCheck.status,
            rootEnginesNode: rootCheck.enginesNode,
            rootEolDate: rootCheck.eolDate,
            findings,
            lastScannedAt: projectSummary?.lastScannedAt ?? null,
            engineScanStale: projectSummary?.engineScanStale ?? false,
            engineScanStaleReason: projectSummary?.engineScanStaleReason ?? null
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
                this.overlayLoader.loadVulnerabilities(projectId),
                this.overlayLoader.loadLicenses(projectId),
                this.autoFixManager.loadSettings(projectId),
                this.autoFixManager.loadPullRequests(projectId),
                this.loadProjectTeams(projectId),
                this.loadAvailableTeams(),
                this.loadEngineData(projectId)
            ]);
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public scan = async (force?: boolean): Promise<void> => {
        await this.scanManager.scan(force);
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

    private loadEngineData = async (projectId: string): Promise<void> => {
        try {
            const [response, summary] = await Promise.all([
                this.enginesGateway.getByProject(projectId),
                this.enginesGateway.getSummary()
            ]);
            runInAction(() => {
                this.enginesRepository.setChecks(response.items, response.total);
                this.enginesRepository.setSummary(summary);
            });
        } catch {
            // Engine data is supplementary — its failure should not break the detail page.
        }
    };

    public togglePackage = (name: string): void => this.selectionManager.toggle(name);
    public selectAll = (): void => this.selectionManager.selectAll();
    public deselectAll = (): void => this.selectionManager.deselectAll();

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
        await this.autoFixManager.updateSettings(input);
    };

    public generateAutoFixPrs = async (): Promise<void> => {
        await this.autoFixManager.generate();
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

    public toggleMaintenance = (): void => {
        this.showMaintenanceValue = !this.showMaintenanceValue;
    };

    public dispose = (): void => {
        this.changelogTracker.dispose();
        this.scanManager.dispose();
        this.disposeUrlListener();
        this.eventBridge.off("install:complete", this.handleInstallComplete);
        this.eventBridge.off("transitive-resolve:complete", this.handleTransitiveResolveComplete);
        this.eventBridge.off("engine-scan:complete", this.handleEngineScanComplete);
    };

    public exportSbom = async (format: string): Promise<void> => {
        await this.sbomExportManager.export(format);
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
        UrlFilterService,
        EnginesGateway,
        EnginesRepository
    ]
});
