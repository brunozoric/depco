import { describe, it, expect, beforeEach } from "vitest";
import {
    listProjectsRoute,
    createProjectRoute,
    deleteProjectRoute,
    checkProjectSecurityRoute,
    getEngineSummaryRoute
} from "#shared/routes/index.js";
import type { ProjectsGateway } from "../../../../features/Projects/abstractions/ProjectsGateway.js";
import {
    createProjectListPresenterTestHarness,
    type IProjectListPresenterTestHarness
} from "./ProjectListPresenter.testHelpers.js";

// This file covers the presenter's core CRUD/load surface: initial view
// model, loading projects, adding/removing projects, and refreshing
// security. Scan-related behavior lives in ProjectListPresenter.scan.test.ts
// and clone/browse/search/selection behavior lives in
// ProjectListPresenter.filters.test.ts.
describe("ProjectListPresenter - CRUD and load", () => {
    let harness: IProjectListPresenterTestHarness;

    beforeEach(() => {
        harness = createProjectListPresenterTestHarness();
    });

    it("starts with an empty, idle view model", () => {
        const presenter = harness.createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            bulkActionRunning: false,
            projects: [],
            addProjectPath: "",
            addProjectLoading: false,
            addProjectError: null,
            cloneUrl: "",
            cloneFolderName: "",
            cloneLoading: false,
            cloneError: null,
            browsePath: "",
            browseItems: [],
            browseLoading: false,
            scanResults: [],
            scanLoading: false,
            scanSummary: null,
            scanDepth: 1,
            searchQuery: "",
            selectedProjectIds: [],
            scanningAllEngines: false,
            page: 1,
            pageSize: 25,
            totalPages: 0,
            totalProjects: 0
        });
    });

    it("sets loading true synchronously while load() is in flight, then false", async () => {
        const presenter = harness.createPresenter();

        const pending = presenter.load();
        expect(presenter.vm.loading).toBe(true);

        await pending;

        expect(presenter.vm.loading).toBe(false);
    });

    it("loads projects and maps them into view-ready items with an idle scan status", async () => {
        const presenter = harness.createPresenter();
        const projects: ProjectsGateway.Project[] = [
            {
                id: "p1",
                name: "with-security",
                path: "/tmp/with-security",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1000,
                lastScannedAt: 2000,
                security: { passes: true, checks: { enableScripts: true } },
                hasNodeModules: false
            },
            {
                id: "p2",
                name: "no-security",
                path: "/tmp/no-security",
                pmVersion: null,
                packageManager: null,
                addedAt: 1500,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];
        harness.getResult = projects;

        await presenter.load();

        expect(harness.calls).toEqual([
            {
                route: listProjectsRoute,
                args: {
                    params: {},
                    query: { page: 1, pageSize: 25, search: undefined, teamId: undefined }
                }
            },
            { route: getEngineSummaryRoute, args: { params: {} } }
        ]);
        expect(presenter.vm.projects).toEqual([
            {
                id: "p1",
                name: "with-security",
                path: "/tmp/with-security",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                securityPasses: true,
                securityChecks: { enableScripts: true },
                lastScannedAt: 2000,
                scanStatus: "idle",
                hasNodeModules: false,
                teams: [],
                engineStatus: null,
                engineVersion: null
            },
            {
                id: "p2",
                name: "no-security",
                path: "/tmp/no-security",
                pmVersion: null,
                packageManager: null,
                securityPasses: null,
                securityChecks: null,
                lastScannedAt: null,
                scanStatus: "idle",
                hasNodeModules: false,
                teams: [],
                engineStatus: null,
                engineVersion: null
            }
        ]);
    });

    it("updates addProjectPath via setAddProjectPath", () => {
        const presenter = harness.createPresenter();

        presenter.setAddProjectPath("/tmp/new-project");

        expect(presenter.vm.addProjectPath).toBe("/tmp/new-project");
    });

    it("adds a project, appends it to the list, and clears the path on success", async () => {
        const presenter = harness.createPresenter();
        const created: ProjectsGateway.Project = {
            id: "p3",
            name: "new-project",
            path: "/tmp/new-project",
            pmVersion: null,
            packageManager: null,
            addedAt: 3000,
            lastScannedAt: null,
            hasNodeModules: false
        };
        harness.postResult = created;

        presenter.setAddProjectPath("/tmp/new-project");
        await presenter.addProject();

        expect(harness.calls).toEqual([
            {
                route: createProjectRoute,
                args: { params: {}, body: { path: "/tmp/new-project" } }
            }
        ]);
        expect(presenter.vm.addProjectPath).toBe("");
        expect(presenter.vm.addProjectLoading).toBe(false);
        expect(presenter.vm.addProjectError).toBeNull();
        expect(presenter.vm.projects).toEqual([
            {
                id: "p3",
                name: "new-project",
                path: "/tmp/new-project",
                pmVersion: null,
                packageManager: null,
                securityPasses: null,
                securityChecks: null,
                lastScannedAt: null,
                scanStatus: "idle",
                hasNodeModules: false,
                teams: [],
                engineStatus: null,
                engineVersion: null
            }
        ]);
    });

    it("records an error and keeps the path when adding a project fails", async () => {
        const presenter = harness.createPresenter();
        harness.postError = new Error("Path is not a valid Yarn project");

        presenter.setAddProjectPath("/tmp/bad-project");
        await presenter.addProject();

        expect(presenter.vm.addProjectError).toBe("Path is not a valid Yarn project");
        expect(presenter.vm.addProjectLoading).toBe(false);
        expect(presenter.vm.addProjectPath).toBe("/tmp/bad-project");
        expect(presenter.vm.projects).toEqual([]);
    });

    it("removes a project from the list", async () => {
        const presenter = harness.createPresenter();
        const remaining: ProjectsGateway.Project = {
            id: "p1",
            name: "keep-me",
            path: "/tmp/keep-me",
            pmVersion: "4.1.0",
            packageManager: "yarn",
            addedAt: 1000,
            lastScannedAt: null,
            hasNodeModules: false
        };
        const removed: ProjectsGateway.Project = {
            id: "p2",
            name: "remove-me",
            path: "/tmp/remove-me",
            pmVersion: "4.1.0",
            packageManager: "yarn",
            addedAt: 1500,
            lastScannedAt: null,
            hasNodeModules: false
        };
        harness.getResult = [remaining, removed];
        await presenter.load();

        await presenter.removeProject("p2");

        expect(harness.calls).toEqual([
            {
                route: listProjectsRoute,
                args: {
                    params: {},
                    query: { page: 1, pageSize: 25, search: undefined, teamId: undefined }
                }
            },
            { route: getEngineSummaryRoute, args: { params: {} } },
            { route: deleteProjectRoute, args: { params: { id: "p2" } } }
        ]);
        expect(presenter.vm.projects.map(project => project.id)).toEqual(["p1"]);
    });

    it("refreshes security for all projects and reloads the list", async () => {
        harness.getResult = [
            {
                id: "p1",
                name: "one",
                path: "/tmp/one",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];
        const presenter = harness.createPresenter();
        await presenter.load();
        harness.calls = [];

        await presenter.refreshAllSecurity();

        expect(harness.calls.some(c => c.route === checkProjectSecurityRoute)).toBe(true);
        expect(harness.calls.some(c => c.route === listProjectsRoute)).toBe(true);
        expect(presenter.vm.bulkActionRunning).toBe(false);
    });
});
