import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { TrendsPresenter } from "../TrendsPage/abstractions/TrendsPresenter.js";
import { TrendsPresenter as TrendsPresenterRegistration } from "../TrendsPage/TrendsPresenter.js";
import { LoadTrendsUseCase as LoadTrendsUseCaseAbstraction } from "../useCases/abstractions/LoadTrendsUseCase.js";
import { LoadDependencyChangesUseCase as LoadDependencyChangesUseCaseAbstraction } from "../useCases/abstractions/LoadDependencyChangesUseCase.js";
import { TrendsRepository as TrendsRepositoryAbstraction } from "../../../features/Trends/abstractions/TrendsRepository.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseAbstraction } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";
import { ProjectsRepository as ProjectsRepositoryAbstraction } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import type { DashboardGateway } from "../../../features/Dashboard/abstractions/DashboardGateway.js";
import type { TrendsGateway } from "../../../features/Trends/abstractions/TrendsGateway.js";
import type { LoadTrendsUseCase } from "../useCases/abstractions/LoadTrendsUseCase.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";

interface FakeTrendsRepositoryHandle {
    repository: TrendsRepositoryAbstraction.Interface;
    setStalenessTrend: (points: DashboardGateway.StalenessTrendPoint[]) => void;
}

function createFakeTrendsRepository(): FakeTrendsRepositoryHandle {
    let stalenessTrend: DashboardGateway.StalenessTrendPoint[] = [];
    let licenseTrend: DashboardGateway.LicenseTrendPoint[] = [];
    let autoFixTrend: DashboardGateway.AutoFixTrendPoint[] = [];
    let dependencyChanges: TrendsGateway.DependencyChangeItem[] = [];
    let dependencyChangesTotal = 0;

    const repository: TrendsRepositoryAbstraction.Interface = {
        getStalenessTrend: () => stalenessTrend,
        setStalenessTrend: points => {
            stalenessTrend = points;
        },
        getLicenseTrend: () => licenseTrend,
        setLicenseTrend: points => {
            licenseTrend = points;
        },
        getAutoFixTrend: () => autoFixTrend,
        setAutoFixTrend: points => {
            autoFixTrend = points;
        },
        getDependencyChanges: () => dependencyChanges,
        setDependencyChanges: (items, total) => {
            dependencyChanges = items;
            dependencyChangesTotal = total;
        },
        getDependencyChangesTotal: () => dependencyChangesTotal
    };

    return {
        repository,
        setStalenessTrend: points => {
            stalenessTrend = points;
        }
    };
}

function createFakeProjectsRepository(
    projects: Array<{ id: string; name: string }>
): ProjectsRepositoryAbstraction.Interface {
    return {
        getProjects: () =>
            projects.map(project => ({
                id: project.id,
                name: project.name,
                path: `/projects/${project.name}`,
                packageManager: null,
                pmVersion: null,
                addedAt: 0,
                lastScannedAt: null,
                hasNodeModules: false
            })),
        setProjects: () => {},
        getProject: () => undefined,
        getDependencies: () => undefined,
        setDependencies: () => {},
        getSecurityStatus: () => undefined,
        setSecurityStatus: () => {},
        clear: () => {}
    };
}

interface PresenterTestHandle {
    presenter: TrendsPresenter.Interface;
    loadTrendsCalls: LoadTrendsUseCase.Ranges[];
    dependencyChangesCalls: Array<TrendsGateway.DependencyChangesFilters | undefined>;
    repositoryHandle: FakeTrendsRepositoryHandle;
}

function createPresenter(
    projects: Array<{ id: string; name: string }> = [],
    loadTrendsBehavior?: (ranges: LoadTrendsUseCase.Ranges) => Promise<void> | void
): PresenterTestHandle {
    const container = createContainer();
    const repositoryHandle = createFakeTrendsRepository();

    const loadTrendsCalls: LoadTrendsUseCase.Ranges[] = [];
    const dependencyChangesCalls: Array<TrendsGateway.DependencyChangesFilters | undefined> = [];

    container.registerInstance(TrendsRepositoryAbstraction, repositoryHandle.repository);

    container.registerInstance(LoadTrendsUseCaseAbstraction, {
        execute: async (ranges: LoadTrendsUseCase.Ranges) => {
            loadTrendsCalls.push(ranges);
            if (loadTrendsBehavior) {
                await loadTrendsBehavior(ranges);
            }
        }
    });

    container.registerInstance(LoadDependencyChangesUseCaseAbstraction, {
        execute: async (filters?: TrendsGateway.DependencyChangesFilters) => {
            dependencyChangesCalls.push(filters);
        }
    });

    container.registerInstance(
        ProjectsRepositoryAbstraction,
        createFakeProjectsRepository(projects)
    );
    container.registerInstance(LoadProjectsUseCaseAbstraction, { execute: async () => {} });

    TeamFilterFeature.register(container);
    container.register(TrendsPresenterRegistration);
    const presenter = container.resolve(TrendsPresenter);

    return { presenter, loadTrendsCalls, dependencyChangesCalls, repositoryHandle };
}

describe("TrendsPresenter", () => {
    it("starts with loading true and default ranges of 30", () => {
        const { presenter } = createPresenter();

        expect(presenter.vm.loading).toBe(true);
        expect(presenter.vm.stalenessRange).toBe("30");
        expect(presenter.vm.licenseRange).toBe("30");
        expect(presenter.vm.autoFixRange).toBe("30");
        expect(presenter.vm.dependencyChangesProjectFilter).toBeNull();
    });

    it("load() fetches all three trends and dependency changes and sets loading to false", async () => {
        const { presenter, loadTrendsCalls, dependencyChangesCalls } = createPresenter([
            { id: "p1", name: "my-app" }
        ]);

        await presenter.load();

        expect(presenter.vm.loading).toBe(false);
        expect(loadTrendsCalls).toEqual([{ staleness: "30", license: "30", autoFix: "30" }]);
        expect(dependencyChangesCalls).toEqual([{}]);
        expect(presenter.vm.availableProjects).toEqual([{ id: "p1", name: "my-app" }]);
    });

    it("setStalenessRange updates only the staleness range and re-fetches only staleness", async () => {
        const { presenter, loadTrendsCalls } = createPresenter();
        await presenter.load();
        loadTrendsCalls.length = 0;

        presenter.setStalenessRange("7");

        expect(presenter.vm.stalenessRange).toBe("7");
        expect(presenter.vm.licenseRange).toBe("30");
        expect(presenter.vm.autoFixRange).toBe("30");
        expect(loadTrendsCalls).toEqual([{ staleness: "7" }]);
    });

    it("setLicenseRange updates only the license range and re-fetches only license", async () => {
        const { presenter, loadTrendsCalls } = createPresenter();
        await presenter.load();
        loadTrendsCalls.length = 0;

        presenter.setLicenseRange("90");

        expect(presenter.vm.licenseRange).toBe("90");
        expect(presenter.vm.stalenessRange).toBe("30");
        expect(presenter.vm.autoFixRange).toBe("30");
        expect(loadTrendsCalls).toEqual([{ license: "90" }]);
    });

    it("setAutoFixRange updates only the auto-fix range and re-fetches only auto-fix", async () => {
        const { presenter, loadTrendsCalls } = createPresenter();
        await presenter.load();
        loadTrendsCalls.length = 0;

        presenter.setAutoFixRange("7");

        expect(presenter.vm.autoFixRange).toBe("7");
        expect(presenter.vm.stalenessRange).toBe("30");
        expect(presenter.vm.licenseRange).toBe("30");
        expect(loadTrendsCalls).toEqual([{ autoFix: "7" }]);
    });

    it("derives packageCountPoints from stalenessPoints (date + totalPackages)", async () => {
        const { presenter, repositoryHandle } = createPresenter();
        repositoryHandle.setStalenessTrend([
            {
                date: "2026-08-01",
                patchOutdated: 1,
                minorOutdated: 2,
                majorOutdated: 3,
                totalPackages: 100
            },
            {
                date: "2026-08-02",
                patchOutdated: 0,
                minorOutdated: 1,
                majorOutdated: 0,
                totalPackages: 102
            }
        ]);

        expect(presenter.vm.packageCountPoints).toEqual([
            { date: "2026-08-01", totalPackages: 100 },
            { date: "2026-08-02", totalPackages: 102 }
        ]);
    });

    it("setDependencyChangesProjectFilter re-fetches dependency changes with the project filter", async () => {
        const { presenter, dependencyChangesCalls } = createPresenter();
        await presenter.load();
        dependencyChangesCalls.length = 0;

        presenter.setDependencyChangesProjectFilter("p1");

        expect(presenter.vm.dependencyChangesProjectFilter).toBe("p1");
        expect(dependencyChangesCalls).toEqual([{ projectId: "p1" }]);

        presenter.setDependencyChangesProjectFilter(null);

        expect(presenter.vm.dependencyChangesProjectFilter).toBeNull();
        expect(dependencyChangesCalls).toEqual([{ projectId: "p1" }, {}]);
    });

    it("sets error and clears loading when load() fails", async () => {
        const { presenter } = createPresenter([], () => {
            throw new Error("network down");
        });

        await presenter.load();

        expect(presenter.vm.error).toBe("network down");
        expect(presenter.vm.loading).toBe(false);
    });

    it("sets error when an independent range re-fetch fails", async () => {
        let shouldFail = false;
        const { presenter } = createPresenter([], ranges => {
            if (shouldFail && ranges.staleness !== undefined) {
                throw new Error("staleness fetch failed");
            }
        });
        await presenter.load();
        shouldFail = true;

        presenter.setStalenessRange("7");
        await Promise.resolve();
        await Promise.resolve();

        expect(presenter.vm.error).toBe("staleness fetch failed");
    });
});
