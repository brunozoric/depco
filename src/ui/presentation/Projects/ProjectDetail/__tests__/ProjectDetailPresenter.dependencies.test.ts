import { describe, it, expect, beforeEach } from "vitest";
import {
    createProjectDetailTestContext,
    type ProjectDetailTestContext
} from "./ProjectDetailPresenter.testHelpers.js";
import {
    createTransientJobRoute,
    updatePackageManagerRoute,
    upsertScanScheduleRoute,
    deleteScanScheduleRoute
} from "#shared/routes/index.js";

describe("ProjectDetailPresenter - dependency selection and schedule", () => {
    let ctx: ProjectDetailTestContext;

    beforeEach(() => {
        ctx = createProjectDetailTestContext();
    });

    it("toggles package selection and updates selectedCount and canUpgrade", async () => {
        const presenter = ctx.createPresenter();
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

        presenter.togglePackage("left-pad");

        expect(presenter.vm.selectedCount).toBe(1);
        expect(presenter.vm.canUpgrade).toBe(true);
        expect(
            presenter.vm.dependencies.find(dependency => dependency.name === "left-pad")?.selected
        ).toBe(true);

        presenter.togglePackage("left-pad");

        expect(presenter.vm.selectedCount).toBe(0);
        expect(presenter.vm.canUpgrade).toBe(false);
    });

    it("selects and deselects all packages", async () => {
        const presenter = ctx.createPresenter();
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

        presenter.selectAll();
        expect(presenter.vm.selectedCount).toBe(2);
        expect(presenter.vm.dependencies.every(dependency => dependency.selected)).toBe(true);

        presenter.deselectAll();
        expect(presenter.vm.selectedCount).toBe(0);
        expect(presenter.vm.dependencies.every(dependency => !dependency.selected)).toBe(true);
    });

    it("refreshes transient dependencies for the loaded project", async () => {
        const presenter = ctx.createPresenter();
        await ctx.loadAndFlush(presenter, "p1");
        ctx.calls = [];

        await presenter.refreshTransient();

        expect(ctx.calls).toEqual([
            { route: createTransientJobRoute, args: { params: { id: "p1" } } }
        ]);
    });

    it("updates the package manager version via setPackageManagerUpdateVersion and updatePackageManager", async () => {
        const presenter = ctx.createPresenter();
        await ctx.loadAndFlush(presenter, "p1");
        ctx.calls = [];

        presenter.setPackageManagerUpdateVersion("4.2.0");
        expect(presenter.vm.packageManagerUpdateVersion).toBe("4.2.0");

        await presenter.updatePackageManager();

        expect(ctx.calls).toEqual([
            {
                route: updatePackageManagerRoute,
                args: { params: { id: "p1" }, body: { version: "4.2.0" } }
            }
        ]);
    });

    describe("schedule", () => {
        it("exposes the resolved schedule for the loaded project", async () => {
            const presenter = ctx.createPresenter();
            ctx.scanSchedulesItems = [
                {
                    projectId: "p1",
                    projectName: "test-project",
                    interval: "24h",
                    source: "default",
                    lastRunAt: null,
                    nextRunAt: null
                }
            ];
            ctx.scanScheduleGlobalDefault = "24h";

            await ctx.loadAndFlush(presenter, "p1");

            expect(presenter.vm.schedule).toEqual({
                interval: "24h",
                source: "default",
                globalDefault: "24h"
            });
        });

        it("is null when no schedule exists for the project", async () => {
            const presenter = ctx.createPresenter();

            await ctx.loadAndFlush(presenter, "p1");

            expect(presenter.vm.schedule).toBeNull();
        });

        it("updateSchedule calls gateway and reflects the project-level override", async () => {
            const presenter = ctx.createPresenter();
            ctx.scanSchedulesItems = [
                {
                    projectId: "p1",
                    projectName: "test-project",
                    interval: "24h",
                    source: "default",
                    lastRunAt: null,
                    nextRunAt: null
                }
            ];
            ctx.scanScheduleGlobalDefault = "24h";
            await ctx.loadAndFlush(presenter, "p1");
            ctx.calls = [];

            await presenter.updateSchedule("6h");

            expect(ctx.calls).toEqual([
                {
                    route: upsertScanScheduleRoute,
                    args: { params: { projectId: "p1" }, body: { interval: "6h" } }
                }
            ]);
            expect(presenter.vm.schedule).toEqual({
                interval: "6h",
                source: "project",
                globalDefault: "24h"
            });
        });

        it("resetSchedule calls gateway and reverts to the global default", async () => {
            const presenter = ctx.createPresenter();
            ctx.scanSchedulesItems = [
                {
                    projectId: "p1",
                    projectName: "test-project",
                    interval: "6h",
                    source: "project",
                    lastRunAt: null,
                    nextRunAt: null
                }
            ];
            ctx.scanScheduleGlobalDefault = "24h";
            await ctx.loadAndFlush(presenter, "p1");
            ctx.calls = [];

            await presenter.resetSchedule();

            expect(ctx.calls).toEqual([
                { route: deleteScanScheduleRoute, args: { params: { projectId: "p1" } } }
            ]);
            expect(presenter.vm.schedule).toEqual({
                interval: "24h",
                source: "default",
                globalDefault: "24h"
            });
        });

        it("updateSchedule and resetSchedule are no-ops without a loaded project", async () => {
            const presenter = ctx.createPresenter();

            await presenter.updateSchedule("6h");
            await presenter.resetSchedule();

            expect(ctx.calls.some(c => c.route === upsertScanScheduleRoute)).toBe(false);
            expect(ctx.calls.some(c => c.route === deleteScanScheduleRoute)).toBe(false);
        });
    });
});
