import { describe, it, expect, beforeEach } from "vitest";
import {
    createProjectDetailTestContext,
    flushMicrotasks,
    type ProjectDetailTestContext
} from "./ProjectDetailPresenter.testHelpers.js";
import {
    scanProjectAsyncRoute,
    getProjectDependenciesRoute,
    getProjectSecurityRoute
} from "#shared/routes/index.js";

describe("ProjectDetailPresenter - load and scan", () => {
    let ctx: ProjectDetailTestContext;

    beforeEach(() => {
        ctx = createProjectDetailTestContext();
    });

    it("starts with an empty, idle view model", () => {
        const presenter = ctx.createPresenter();

        expect(presenter.vm).toEqual({
            loading: false,
            scanning: false,
            scanProgress: null,
            scanError: null,
            scanWarning: null,
            project: null,
            security: null,
            dependencies: [],
            upgradeFilter: "all",
            totalDependencyCount: 0,
            search: "",
            page: 1,
            pageSize: 25,
            totalPages: 0,
            canUpgrade: false,
            selectedCount: 0,
            packageManagerUpdateVersion: "",
            schedule: null,
            autoFixSettings: null,
            autoFixPullRequests: [],
            autoFixRunning: false,
            exportingSbom: false,
            sbomExportError: null,
            projectTeamIds: [],
            availableTeams: [],
            changelogState: null,
            engineData: null,
            showMaintenance: true
        });
    });

    it("registers WebSocket listeners for scan events on construction", () => {
        ctx.createPresenter();

        expect(ctx.fakeEventBridge.listenerCount("scan:progress")).toBe(1);
        expect(ctx.fakeEventBridge.listenerCount("scan:complete")).toBe(1);
        expect(ctx.fakeEventBridge.listenerCount("scan:failed")).toBe(1);
        expect(ctx.fakeEventBridge.listenerCount("transitive-resolve:complete")).toBe(1);
    });

    it("sets loading true synchronously while load() is in flight, then false", async () => {
        const presenter = ctx.createPresenter();

        const pending = presenter.load("p1");
        expect(presenter.vm.loading).toBe(true);

        await pending;

        expect(presenter.vm.loading).toBe(false);
    });

    it("loads project, security, and persisted dependencies without auto-scanning", async () => {
        const presenter = ctx.createPresenter();
        ctx.projectsListResult = [
            {
                id: "p1",
                name: "test-project",
                path: "/tmp/test-project",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1000,
                lastScannedAt: null
            }
        ];
        ctx.dependenciesResult = [
            {
                name: "left-pad",
                currentVersion: "1.0.0",
                latestInRange: "1.2.0",
                latestVersion: "2.0.0",
                type: "dependency",
                upgradeType: "minor"
            },
            {
                name: "chalk",
                currentVersion: "4.0.0",
                latestInRange: "4.1.0",
                latestVersion: "5.0.0",
                type: "devDependency",
                upgradeType: "major"
            }
        ];

        await ctx.loadAndFlush(presenter, "p1");

        expect(presenter.vm.project).toEqual({
            id: "p1",
            name: "test-project",
            path: "/tmp/test-project",
            pmVersion: "4.1.0",
            packageManager: "yarn"
        });
        expect(presenter.vm.security).toEqual(ctx.securityResult);
        expect(presenter.vm.dependencies).toHaveLength(2);
        expect(presenter.vm.dependencies[0]?.name).toBe("left-pad");
        expect(presenter.vm.canUpgrade).toBe(false);
        expect(presenter.vm.selectedCount).toBe(0);
        expect(presenter.vm.scanning).toBe(false);
        expect(ctx.calls.some(c => c.route === scanProjectAsyncRoute)).toBe(false);
    });

    describe("scan", () => {
        it("enqueues an async scan job and sets scanning true", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.calls = [];

            const pending = presenter.scan(true);
            expect(presenter.vm.scanning).toBe(true);
            await pending;

            expect(ctx.calls).toEqual([
                {
                    route: scanProjectAsyncRoute,
                    args: { params: { id: "p1" }, query: { force: "true" } }
                }
            ]);
            expect(presenter.vm.scanning).toBe(true);
        });

        it("updates scanProgress on scan:progress events for the current project", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            await presenter.scan();

            ctx.fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 3,
                total: 10
            });

            expect(presenter.vm.scanProgress).toEqual({
                packageName: "lodash",
                current: 3,
                total: 10
            });
        });

        it("ignores scan:progress events for a different project", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            await presenter.scan();

            ctx.fakeEventBridge.emit("scan:progress", {
                projectId: "other-project",
                packageName: "lodash",
                current: 3,
                total: 10
            });

            expect(presenter.vm.scanProgress).toBeNull();
        });

        it("reloads dependencies and security, and clears scanning on scan:complete", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            await presenter.scan();
            ctx.calls = [];
            ctx.dependenciesResult = [
                {
                    name: "left-pad",
                    currentVersion: "1.0.0",
                    latestInRange: "1.0.0",
                    latestVersion: "1.0.0",
                    type: "dependency",
                    upgradeType: "none"
                }
            ];
            ctx.securityResult = { passes: false, checks: { enableScripts: false } };

            ctx.fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
            await flushMicrotasks();

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();
            expect(presenter.vm.dependencies).toHaveLength(1);
            expect(presenter.vm.dependencies[0]?.name).toBe("left-pad");
            expect(presenter.vm.security).toEqual(ctx.securityResult);
            expect(ctx.calls.some(c => c.route === getProjectDependenciesRoute)).toBe(true);
            expect(ctx.calls.some(c => c.route === getProjectSecurityRoute)).toBe(true);
        });

        it("ignores scan:complete events for a different project", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            await presenter.scan();

            ctx.fakeEventBridge.emit("scan:complete", {
                projectId: "other-project",
                warning: null
            });
            await flushMicrotasks();

            expect(presenter.vm.scanning).toBe(true);
        });

        it("clears scanning and scanProgress on scan:failed and exposes error message", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            await presenter.scan();
            ctx.fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 1,
                total: 10
            });

            ctx.fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();
            expect(presenter.vm.scanError).toBe("boom");
        });

        it("clears scanError when a new scan starts", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            await presenter.scan();
            ctx.fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });
            expect(presenter.vm.scanError).toBe("boom");

            await presenter.scan();

            expect(presenter.vm.scanError).toBeNull();
        });

        it("does not leak scanning/progress state into a different project navigated to afterwards", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            await presenter.scan();

            ctx.fakeEventBridge.emit("scan:progress", {
                projectId: "p1",
                packageName: "lodash",
                current: 3,
                total: 10
            });
            expect(presenter.vm.scanning).toBe(true);
            expect(presenter.vm.scanProgress).toEqual({
                packageName: "lodash",
                current: 3,
                total: 10
            });

            // Navigate away to project B while A is still scanning.
            await ctx.loadAndFlush(presenter, "p2");

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();

            // A's scan:complete arrives after navigation - it must not affect B's view model.
            ctx.fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
            await flushMicrotasks();

            expect(presenter.vm.scanning).toBe(false);
            expect(presenter.vm.scanProgress).toBeNull();

            // Navigating back to A should show it as no longer scanning (completed while away).
            await ctx.loadAndFlush(presenter, "p1");
            expect(presenter.vm.scanning).toBe(false);
        });
    });

    describe("transitive-resolve:complete", () => {
        it("reloads dependencies for the current project", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.calls = [];
            ctx.dependenciesResult = [
                {
                    name: "left-pad",
                    currentVersion: "1.0.0",
                    latestInRange: "1.0.0",
                    latestVersion: "1.0.0",
                    type: "transitive",
                    upgradeType: "none"
                }
            ];

            ctx.fakeEventBridge.emit("transitive-resolve:complete", {
                projectId: "p1",
                resolved: 1,
                failed: 0
            });
            await flushMicrotasks();

            expect(presenter.vm.dependencies).toHaveLength(1);
            expect(presenter.vm.dependencies[0]?.name).toBe("left-pad");
            expect(ctx.calls.some(c => c.route === getProjectDependenciesRoute)).toBe(true);
        });

        it("ignores events for a different project", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.calls = [];

            ctx.fakeEventBridge.emit("transitive-resolve:complete", {
                projectId: "other-project",
                resolved: 5,
                failed: 0
            });
            await flushMicrotasks();

            expect(ctx.calls.some(c => c.route === getProjectDependenciesRoute)).toBe(false);
        });
    });
});
