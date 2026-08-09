import { computed, makeAutoObservable, reaction, runInAction } from "mobx";
import { PackagesPresenter as Abstraction } from "./abstractions/PackagesPresenter.js";
import { LoadPackagesUseCase } from "../useCases/abstractions/LoadPackagesUseCase.js";
import { LoadProjectsUseCase } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";
import { PackagesRepository } from "../../../features/Packages/abstractions/PackagesRepository.js";
import { PackagesGateway } from "../../../features/Packages/abstractions/PackagesGateway.js";
import { ProjectsRepository } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { UpgradesGateway } from "../../../features/Upgrades/abstractions/UpgradesGateway.js";
import { EventBridge } from "../../../events/abstractions/EventBridge.js";
import "../../../events/eventMap.js";
import { ChangelogTracker } from "../../shared/ChangelogTracker.js";
import type { IStartChangelogTrackingInput } from "../../shared/ChangelogTracker.js";
import { TeamFilterService } from "../../../features/TeamFilter/abstractions/TeamFilterService.js";
import { UrlFilterService } from "../../../features/UrlFilter/abstractions/UrlFilterService.js";
import type { z } from "zod";
import { listPackagesRoute } from "#shared/routes/index.js";

const UPGRADE_TYPE_PRIORITY: Record<string, number> = {
    major: 3,
    minor: 2,
    patch: 1,
    none: 0
};

const DEFAULT_PAGE_SIZE = 50;

const FILTER_SCHEMA = listPackagesRoute.querystring as NonNullable<
    typeof listPackagesRoute.querystring
> &
    z.ZodObject<z.ZodRawShape>;

class PackagesPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private expandedPackageName: string | null = null;
    private readonly changelogTracker: ChangelogTracker;
    private readonly disposeTeamReaction: () => void;
    private readonly disposeUrlListener: () => void;

    private readonly handleScanComplete: EventBridge.Callback<"scan:complete">;
    private readonly handleTransitiveResolveComplete: EventBridge.Callback<"transitive-resolve:complete">;

    public constructor(
        private readonly loadPackagesUseCase: LoadPackagesUseCase.Interface,
        private readonly loadProjectsUseCase: LoadProjectsUseCase.Interface,
        private readonly packagesRepository: PackagesRepository.Interface,
        private readonly projectsRepository: ProjectsRepository.Interface,
        private readonly packagesGateway: PackagesGateway.Interface,
        private readonly upgradesGateway: UpgradesGateway.Interface,
        private readonly eventBridge: EventBridge.Interface,
        private readonly teamFilterService: TeamFilterService.Interface,
        private readonly urlFilterService: UrlFilterService.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
        this.changelogTracker = new ChangelogTracker(this.eventBridge);

        this.handleScanComplete = () => {
            void this.load();
        };

        this.handleTransitiveResolveComplete = () => {
            void this.load();
        };

        this.eventBridge.on("scan:complete", this.handleScanComplete);
        this.eventBridge.on("transitive-resolve:complete", this.handleTransitiveResolveComplete);

        this.disposeTeamReaction = reaction(
            () => this.teamFilterService.selectedTeamId,
            () => {
                void this.load();
            }
        );

        this.disposeUrlListener = this.urlFilterService.onChange(() => {
            void this.load();
        });
    }

    public get vm(): Abstraction.ViewModel {
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const totalCount = this.packagesRepository.getTotal();
        const pageSize = urlFilters.pageSize ?? DEFAULT_PAGE_SIZE;
        const packages = this.packagesRepository
            .getPackages()
            .map((pkg): Abstraction.PackageListItem => {
                const highest = pkg.projects.reduce(
                    (best, project) => {
                        const priority = UPGRADE_TYPE_PRIORITY[project.upgradeType] ?? 0;
                        return priority > best.priority
                            ? { type: project.upgradeType, priority }
                            : best;
                    },
                    { type: "none", priority: 0 }
                );

                const versions = pkg.projects.map(p => p.currentVersion);
                const latestVersions = pkg.projects.map(p => p.latestVersion);

                return {
                    name: pkg.name,
                    projects: pkg.projects,
                    changelogCount: pkg.changelogCount,
                    highestUpgradeType: highest.type,
                    minCurrentVersion: versions[0] ?? "",
                    maxLatestVersion: latestVersions[latestVersions.length - 1] ?? "",
                    lastPublishedAt: pkg.lastPublishedAt,
                    registryResolved: pkg.registryResolved
                };
            });

        const projectOptions = this.projectsRepository.getProjects().map(project => ({
            value: project.id,
            label: project.name
        }));

        return {
            loading: this.loading,
            error: this.error,
            packages,
            search: urlFilters.search ?? "",
            upgradeType: urlFilters.upgradeType ?? null,
            dependencyKind: urlFilters.dependencyKind ?? null,
            projectId: urlFilters.projectId ?? null,
            hasChangelog: urlFilters.hasChangelog === "true",
            projectOptions,
            page: urlFilters.page ?? 1,
            pageSize,
            totalCount,
            totalPages: Math.ceil(totalCount / pageSize),
            sortBy: urlFilters.sortBy ?? "name",
            sortOrder: urlFilters.sortOrder ?? "asc",
            expandedPackageName: this.expandedPackageName,
            changelogState: this.changelogTracker.state
        };
    }

    public load = async (): Promise<void> => {
        this.loading = true;
        this.error = null;
        try {
            await Promise.all([
                this.loadPackagesUseCase.execute(this.buildFilters()),
                this.loadProjectsUseCase.execute()
            ]);
        } catch (error) {
            runInAction(() => {
                this.error = error instanceof Error ? error.message : "Failed to load packages";
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public setSearch = (value: string): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { search: value || null, page: null });
    };

    public setUpgradeType = (value: string | null): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { upgradeType: value, page: null });
    };

    public setDependencyKind = (value: string | null): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { dependencyKind: value, page: null });
    };

    public setProjectId = (value: string | null): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { projectId: value, page: null });
    };

    public setHasChangelog = (value: boolean): void => {
        this.urlFilterService.update(FILTER_SCHEMA, {
            hasChangelog: value ? "true" : null,
            page: null
        });
    };

    public setPage = (page: number): void => {
        this.urlFilterService.update(FILTER_SCHEMA, { page: String(page) });
    };

    public setSortBy = (sortBy: string): void => {
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);
        const currentSortBy = urlFilters.sortBy ?? "name";
        const newSortOrder =
            currentSortBy === sortBy
                ? (urlFilters.sortOrder ?? "asc") === "asc"
                    ? "desc"
                    : "asc"
                : sortBy === "lastPublishedAt"
                  ? "desc"
                  : "asc";
        this.urlFilterService.update(FILTER_SCHEMA, {
            sortBy,
            sortOrder: newSortOrder,
            page: null
        });
    };

    public togglePackageDetails = (name: string): void => {
        this.expandedPackageName = this.expandedPackageName === name ? null : name;
    };

    public upgradePackage = async (
        projectId: string,
        packageName: string,
        targetVersion: string
    ): Promise<void> => {
        await this.upgradesGateway.startUpgrade(
            projectId,
            [{ name: packageName, targetVersion }],
            false
        );
    };

    public rescanPackage = async (packageName: string): Promise<void> => {
        await this.packagesGateway.rescanPackage(packageName);
        await this.load();
    };

    public getChangelogs = async (
        packageName: string,
        from: string,
        to: string
    ): Promise<PackagesGateway.ChangelogResult> => {
        return this.packagesGateway.getChangelogs(packageName, from, to);
    };

    public reResolveChangelogs = async (
        packageName: string,
        from: string,
        to: string
    ): Promise<PackagesGateway.ChangelogResult> => {
        return this.packagesGateway.reResolveChangelogs(packageName, from, to);
    };

    private buildFilters(): PackagesGateway.Filters {
        const teamId = this.teamFilterService.selectedTeamId;
        const urlFilters = this.urlFilterService.read(FILTER_SCHEMA);

        return {
            ...(urlFilters.search ? { search: urlFilters.search } : {}),
            ...(urlFilters.upgradeType ? { upgradeType: urlFilters.upgradeType } : {}),
            ...(urlFilters.dependencyKind ? { dependencyKind: urlFilters.dependencyKind } : {}),
            ...(urlFilters.projectId ? { projectId: urlFilters.projectId } : {}),
            ...(urlFilters.hasChangelog === "true" ? { hasChangelog: true } : {}),
            ...(teamId ? { teamId } : {}),
            page: urlFilters.page ?? 1,
            pageSize: urlFilters.pageSize ?? DEFAULT_PAGE_SIZE,
            sortBy: urlFilters.sortBy ?? "name",
            sortOrder: urlFilters.sortOrder ?? "asc"
        };
    }

    public startChangelogTracking = (input: IStartChangelogTrackingInput): void => {
        this.changelogTracker.startTracking(input);
    };

    public stopChangelogTracking = (): void => {
        this.changelogTracker.stopTracking();
    };

    public dispose = (): void => {
        this.changelogTracker.dispose();
        this.eventBridge.off("scan:complete", this.handleScanComplete);
        this.eventBridge.off("transitive-resolve:complete", this.handleTransitiveResolveComplete);
        this.disposeTeamReaction();
        this.disposeUrlListener();
    };
}

export const PackagesPresenter = Abstraction.createImplementation({
    implementation: PackagesPresenterImpl,
    dependencies: [
        LoadPackagesUseCase,
        LoadProjectsUseCase,
        PackagesRepository,
        ProjectsRepository,
        PackagesGateway,
        UpgradesGateway,
        EventBridge,
        TeamFilterService,
        UrlFilterService
    ]
});
