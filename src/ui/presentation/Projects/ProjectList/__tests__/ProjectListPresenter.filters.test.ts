import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateId } from "@webiny/stdlib";
import {
    cloneProjectRoute,
    listProjectsRoute,
    getEngineSummaryRoute,
    browseFilesystemRoute,
    bulkScanProjectsRoute
} from "#shared/routes/index.js";

vi.mock("@mantine/notifications", () => ({
    notifications: {
        show: vi.fn()
    }
}));

import type { ProjectsGateway } from "../../../../features/Projects/abstractions/ProjectsGateway.js";
import {
    createProjectListPresenterTestHarness,
    type IProjectListPresenterTestHarness
} from "./ProjectListPresenter.testHelpers.js";

// This file covers clone/browse, client-side search filtering, and
// selection/bulk-scan behavior. CRUD/load behavior lives in
// ProjectListPresenter.crud.test.ts and scanAll() behavior lives in
// ProjectListPresenter.scan.test.ts.
describe("ProjectListPresenter - clone, browse, search, and selection", () => {
    let harness: IProjectListPresenterTestHarness;

    beforeEach(() => {
        harness = createProjectListPresenterTestHarness();
    });

    describe("clone and browse", () => {
        it("clone VM fields initialize to defaults", () => {
            const presenter = harness.createPresenter();
            expect(presenter.vm.cloneUrl).toBe("");
            expect(presenter.vm.cloneFolderName).toBe("");
            expect(presenter.vm.cloneLoading).toBe(false);
            expect(presenter.vm.cloneError).toBeNull();
        });

        it("setCloneUrl auto-derives folder name from https URL", () => {
            const presenter = harness.createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            expect(presenter.vm.cloneUrl).toBe("https://github.com/org/my-repo.git");
            expect(presenter.vm.cloneFolderName).toBe("my-repo");
        });

        it("setCloneUrl auto-derives folder name from URL without .git", () => {
            const presenter = harness.createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo");
            expect(presenter.vm.cloneFolderName).toBe("my-repo");
        });

        it("setCloneFolderName overrides the derived folder name", () => {
            const presenter = harness.createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            presenter.setCloneFolderName("custom-name");
            expect(presenter.vm.cloneFolderName).toBe("custom-name");
        });

        it("browseTo fetches directory listing and updates VM", async () => {
            harness.browseItems = [
                { name: "project-a", path: "/some/path/project-a" },
                { name: "project-b", path: "/some/path/project-b" }
            ];
            const presenter = harness.createPresenter();

            await presenter.browseTo("/some/path");

            expect(presenter.vm.browsePath).toBe("/some/path");
            expect(presenter.vm.browseItems).toEqual(harness.browseItems);
            expect(presenter.vm.browseLoading).toBe(false);
            expect(harness.calls).toEqual([
                {
                    route: browseFilesystemRoute,
                    args: { params: {}, query: { path: "/some/path" } }
                }
            ]);
        });

        it("clones a project, clears the form, and reloads the project list on success", async () => {
            const presenter = harness.createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            harness.calls = [];

            await presenter.cloneProject();

            expect(harness.calls).toEqual([
                {
                    route: cloneProjectRoute,
                    args: {
                        params: {},
                        body: {
                            url: "https://github.com/org/my-repo.git",
                            destination: "",
                            folderName: "my-repo"
                        }
                    }
                },
                {
                    route: listProjectsRoute,
                    args: {
                        params: {},
                        query: {
                            page: 1,
                            pageSize: 25,
                            search: undefined,
                            teamId: undefined,
                            sortBy: undefined,
                            sortOrder: undefined,
                            engineStatus: undefined
                        }
                    }
                },
                { route: getEngineSummaryRoute, args: { params: {} } }
            ]);
            expect(presenter.vm.cloneUrl).toBe("");
            expect(presenter.vm.cloneFolderName).toBe("");
            expect(presenter.vm.cloneLoading).toBe(false);
            expect(presenter.vm.cloneError).toBeNull();
        });

        it("records an error and keeps the form when cloning fails", async () => {
            const presenter = harness.createPresenter();
            presenter.setCloneUrl("https://github.com/org/my-repo.git");
            harness.cloneError = new Error("Repository not found");

            await presenter.cloneProject();

            expect(presenter.vm.cloneError).toBe("Repository not found");
            expect(presenter.vm.cloneLoading).toBe(false);
            expect(presenter.vm.cloneUrl).toBe("https://github.com/org/my-repo.git");
        });
    });

    describe("search filtering", () => {
        function makeProject(
            overrides: Partial<ProjectsGateway.Project> = {}
        ): ProjectsGateway.Project {
            return {
                id: generateId(),
                name: "my-app",
                path: "/Projects/my-app",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                lastScannedAt: null,
                hasNodeModules: false,
                security: null,
                teams: [],
                addedAt: Date.now(),
                engineStatus: null,
                rootEnginesNode: null,
                ...overrides
            };
        }

        it("shows all projects when search is empty", async () => {
            harness.getResult = [
                makeProject({ id: "p1", name: "frontend" }),
                makeProject({ id: "p2", name: "backend" })
            ];
            const presenter = harness.createPresenter();
            await presenter.load();
            expect(presenter.vm.projects).toHaveLength(2);
            expect(presenter.vm.searchQuery).toBe("");
        });

        it("filters projects by name", async () => {
            harness.getResult = [
                makeProject({ id: "p1", name: "frontend-app" }),
                makeProject({ id: "p2", name: "backend-api" })
            ];
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.setSearchQuery("frontend");
            await vi.waitFor(() => expect(presenter.vm.projects).toHaveLength(1));
            expect(presenter.vm.projects[0]!.name).toBe("frontend-app");
        });

        it("filters projects by path", async () => {
            harness.getResult = [
                makeProject({ id: "p1", name: "app", path: "/home/user/web" }),
                makeProject({ id: "p2", name: "lib", path: "/home/user/api" })
            ];
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.setSearchQuery("/web");
            await vi.waitFor(() => expect(presenter.vm.projects).toHaveLength(1));
            expect(presenter.vm.projects[0]!.name).toBe("app");
        });

        it("filters projects by package manager", async () => {
            harness.getResult = [
                makeProject({ id: "p1", name: "app-a", packageManager: "yarn" }),
                makeProject({ id: "p2", name: "app-b", packageManager: "pnpm" })
            ];
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.setSearchQuery("pnpm");
            await vi.waitFor(() => expect(presenter.vm.projects).toHaveLength(1));
            expect(presenter.vm.projects[0]!.name).toBe("app-b");
        });

        it("search is case-insensitive", async () => {
            harness.getResult = [
                makeProject({ id: "p1", name: "Frontend-App" }),
                makeProject({ id: "p2", name: "backend" })
            ];
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.setSearchQuery("FRONTEND");
            await vi.waitFor(() => expect(presenter.vm.projects).toHaveLength(1));
            expect(presenter.vm.projects[0]!.name).toBe("Frontend-App");
        });

        it("clearing search restores all projects", async () => {
            harness.getResult = [
                makeProject({ id: "p1", name: "frontend" }),
                makeProject({ id: "p2", name: "backend" })
            ];
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.setSearchQuery("frontend");
            await vi.waitFor(() => expect(presenter.vm.projects).toHaveLength(1));
            presenter.setSearchQuery("");
            await vi.waitFor(() => expect(presenter.vm.projects).toHaveLength(2));
        });
    });

    describe("project selection and bulk scan", () => {
        function makeProject(
            overrides: Partial<ProjectsGateway.Project> = {}
        ): ProjectsGateway.Project {
            return {
                id: generateId(),
                name: "my-app",
                path: "/Projects/my-app",
                packageManager: "yarn",
                pmVersion: "4.0.0",
                lastScannedAt: null,
                hasNodeModules: false,
                security: null,
                teams: [],
                addedAt: Date.now(),
                engineStatus: null,
                rootEnginesNode: null,
                ...overrides
            };
        }

        it("toggles a project's selection on and off", async () => {
            harness.getResult = [makeProject({ id: "p1" }), makeProject({ id: "p2" })];
            const presenter = harness.createPresenter();
            await presenter.load();

            presenter.toggleProjectSelection("p1");
            expect(presenter.vm.selectedProjectIds).toEqual(["p1"]);

            presenter.toggleProjectSelection("p2");
            expect(presenter.vm.selectedProjectIds).toEqual(["p1", "p2"]);

            presenter.toggleProjectSelection("p1");
            expect(presenter.vm.selectedProjectIds).toEqual(["p2"]);
        });

        it("selectAllProjects selects every currently visible project", async () => {
            harness.getResult = [makeProject({ id: "p1" }), makeProject({ id: "p2" })];
            const presenter = harness.createPresenter();
            await presenter.load();

            presenter.selectAllProjects();

            expect(presenter.vm.selectedProjectIds).toEqual(["p1", "p2"]);
        });

        it("deselectAllProjects clears the selection", async () => {
            harness.getResult = [makeProject({ id: "p1" }), makeProject({ id: "p2" })];
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.selectAllProjects();

            presenter.deselectAllProjects();

            expect(presenter.vm.selectedProjectIds).toEqual([]);
        });

        it("removeProject drops the id from the selection", async () => {
            harness.getResult = [makeProject({ id: "p1" }), makeProject({ id: "p2" })];
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.selectAllProjects();

            await presenter.removeProject("p1");

            expect(presenter.vm.selectedProjectIds).toEqual(["p2"]);
        });

        it("bulkScanSelected calls bulkScanProjectsRoute with the selected ids and clears the selection", async () => {
            harness.getResult = [makeProject({ id: "p1" }), makeProject({ id: "p2" })];
            harness.bulkScanResult = { enqueuedCount: 2, skippedCount: 0 };
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.selectAllProjects();
            harness.calls = [];

            await presenter.bulkScanSelected();

            expect(harness.calls).toEqual([
                {
                    route: bulkScanProjectsRoute,
                    args: { params: {}, body: { projectIds: ["p1", "p2"], force: undefined } }
                }
            ]);
            expect(presenter.vm.selectedProjectIds).toEqual([]);

            const { notifications } = await import("@mantine/notifications");
            expect(notifications.show).toHaveBeenCalledWith(
                expect.objectContaining({ title: "Bulk scan enqueued" })
            );
        });

        it("bulkScanSelected does nothing when no projects are selected", async () => {
            harness.getResult = [makeProject({ id: "p1" })];
            const presenter = harness.createPresenter();
            await presenter.load();
            harness.calls = [];

            await presenter.bulkScanSelected();

            expect(harness.calls.filter(c => c.route === bulkScanProjectsRoute)).toEqual([]);
        });

        it("shows an error notification and keeps the selection when bulk scan fails", async () => {
            harness.getResult = [makeProject({ id: "p1" })];
            harness.bulkScanError = new Error("Server exploded");
            const presenter = harness.createPresenter();
            await presenter.load();
            presenter.selectAllProjects();

            await presenter.bulkScanSelected();

            expect(presenter.vm.selectedProjectIds).toEqual(["p1"]);
            const { notifications } = await import("@mantine/notifications");
            expect(notifications.show).toHaveBeenCalledWith(
                expect.objectContaining({ title: "Bulk scan failed", message: "Server exploded" })
            );
        });
    });
});
