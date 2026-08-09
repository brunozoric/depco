import { describe, it, expect } from "vitest";
import { createContainer } from "#shared/index.js";
import { SbomPresenter } from "../SbomPage/abstractions/SbomPresenter.js";
import { SbomPresenter as SbomPresenterRegistration } from "../SbomPage/SbomPresenter.js";
import { ExportSbomUseCase as ExportSbomUseCaseAbstraction } from "../useCases/abstractions/ExportSbomUseCase.js";
import { ProjectsRepository as ProjectsRepositoryAbstraction } from "../../../features/Projects/abstractions/ProjectsRepository.js";
import { LoadProjectsUseCase as LoadProjectsUseCaseAbstraction } from "../../projects/useCases/abstractions/LoadProjectsUseCase.js";

interface MockExportCall {
    method: string;
    args: unknown[];
}

describe("SbomPresenter", () => {
    let exportCalls: MockExportCall[];

    function createPresenter(
        projectList: Array<{ id: string; name: string }> = []
    ): SbomPresenter.Interface {
        const container = createContainer();

        exportCalls = [];
        container.registerInstance(ExportSbomUseCaseAbstraction, {
            exportProject: async (projectId: string, format: string) => {
                exportCalls.push({ method: "exportProject", args: [projectId, format] });
            },
            exportAll: async (format: string) => {
                exportCalls.push({ method: "exportAll", args: [format] });
            }
        });

        container.registerInstance(ProjectsRepositoryAbstraction, {
            getProjects: () =>
                projectList.map(p => ({
                    id: p.id,
                    name: p.name,
                    path: `/projects/${p.name}`,
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
        });

        container.registerInstance(LoadProjectsUseCaseAbstraction, {
            execute: async () => {}
        });

        container.register(SbomPresenterRegistration);
        return container.resolve(SbomPresenter);
    }

    it("starts with loading true and cyclonedx format", () => {
        const presenter = createPresenter();
        expect(presenter.vm.loading).toBe(true);
        expect(presenter.vm.selectedFormat).toBe("cyclonedx");
        expect(presenter.vm.canExportProject).toBe(false);
    });

    it("loads projects and sets loading to false", async () => {
        const presenter = createPresenter([{ id: "p1", name: "my-app" }]);
        await presenter.load();

        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.availableProjects).toEqual([{ id: "p1", name: "my-app" }]);
    });

    it("canExportProject is true when a project is selected", async () => {
        const presenter = createPresenter([{ id: "p1", name: "my-app" }]);
        await presenter.load();

        presenter.setSelectedProjectId("p1");

        expect(presenter.vm.canExportProject).toBe(true);
    });

    it("exportProject calls use case with selected project and format", async () => {
        const presenter = createPresenter([{ id: "p1", name: "my-app" }]);
        await presenter.load();
        presenter.setSelectedProjectId("p1");
        presenter.setSelectedFormat("spdx");

        await presenter.exportProject();

        expect(exportCalls).toEqual([{ method: "exportProject", args: ["p1", "spdx"] }]);
    });

    it("exportAll calls use case with selected format", async () => {
        const presenter = createPresenter();
        await presenter.load();
        presenter.setSelectedFormat("cyclonedx");

        await presenter.exportAll();

        expect(exportCalls).toEqual([{ method: "exportAll", args: ["cyclonedx"] }]);
    });

    it("sets error when export fails", async () => {
        const container = createContainer();
        container.registerInstance(ExportSbomUseCaseAbstraction, {
            exportProject: async () => {
                throw new Error("network down");
            },
            exportAll: async () => {
                throw new Error("network down");
            }
        });
        container.registerInstance(ProjectsRepositoryAbstraction, {
            getProjects: () => [
                {
                    id: "p1",
                    name: "a",
                    path: "/a",
                    packageManager: null,
                    pmVersion: null,
                    addedAt: 0,
                    lastScannedAt: null,
                    hasNodeModules: false
                }
            ],
            setProjects: () => {},
            getProject: () => undefined,
            getDependencies: () => undefined,
            setDependencies: () => {},
            getSecurityStatus: () => undefined,
            setSecurityStatus: () => {},
            clear: () => {}
        });
        container.registerInstance(LoadProjectsUseCaseAbstraction, { execute: async () => {} });
        container.register(SbomPresenterRegistration);
        const presenter = container.resolve(SbomPresenter);

        await presenter.load();
        presenter.setSelectedProjectId("p1");
        await presenter.exportProject();

        expect(presenter.vm.error).toBe("network down");
        expect(presenter.vm.exporting).toBe(false);
    });
});
