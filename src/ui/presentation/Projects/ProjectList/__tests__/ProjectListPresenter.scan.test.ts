import { describe, it, expect, beforeEach } from "vitest";
import { scanProjectAsyncRoute, bulkScanEnginesRoute } from "#shared/routes/index.js";
import {
    createProjectListPresenterTestHarness,
    type IProjectListPresenterTestHarness
} from "./ProjectListPresenter.testHelpers.js";

// This file covers scanAll(): enqueuing per-project scans, tracking
// scanStatus via scan:progress/scan:complete/scan:failed events, and event
// unsubscription on dispose. CRUD/load behavior lives in
// ProjectListPresenter.crud.test.ts and clone/browse/search/selection
// behavior lives in ProjectListPresenter.filters.test.ts.
describe("ProjectListPresenter - scanAll", () => {
    let harness: IProjectListPresenterTestHarness;

    beforeEach(() => {
        harness = createProjectListPresenterTestHarness();
    });

    it("enqueues a scan for every project and marks them scanning", async () => {
        const projects = [
            {
                id: "p1",
                name: "one",
                path: "/tmp/one",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1000,
                lastScannedAt: null,
                hasNodeModules: false
            },
            {
                id: "p2",
                name: "two",
                path: "/tmp/two",
                pmVersion: "4.1.0",
                packageManager: "yarn",
                addedAt: 1500,
                lastScannedAt: null,
                hasNodeModules: false
            }
        ];
        harness.getResult = projects;
        const presenter = harness.createPresenter();
        await presenter.load();
        harness.calls = [];

        const pending = presenter.scanAll();

        expect(presenter.vm.projects.every(project => project.scanStatus === "scanning")).toBe(
            true
        );
        expect(presenter.vm.bulkActionRunning).toBe(true);

        await pending;

        expect(
            harness.calls.filter(c => c.route === scanProjectAsyncRoute).map(c => c.args)
        ).toEqual([
            { params: { id: "p1" }, query: undefined },
            { params: { id: "p2" }, query: undefined }
        ]);
    });

    it("updates per-project scanStatus as scan:progress/scan:complete events arrive", async () => {
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
        await presenter.scanAll();

        harness.fakeEventBridge.emit("scan:progress", {
            projectId: "p1",
            packageName: "lodash",
            current: 1,
            total: 5
        });
        expect(presenter.vm.projects[0]?.scanStatus).toBe("scanning");

        harness.fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(presenter.vm.projects[0]?.scanStatus).toBe("done");
        expect(presenter.vm.bulkActionRunning).toBe(false);
    });

    it("marks a project as failed on scan:failed", async () => {
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
        await presenter.scanAll();

        harness.fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });

        expect(presenter.vm.projects[0]?.scanStatus).toBe("failed");
    });

    it("should unsubscribe from all events on dispose", async () => {
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

        presenter.dispose();

        harness.fakeEventBridge.emit("scan:progress", {
            projectId: "p1",
            packageName: "lodash",
            current: 1,
            total: 5
        });
        harness.fakeEventBridge.emit("scan:complete", { projectId: "p1", warning: null });
        harness.fakeEventBridge.emit("scan:failed", { projectId: "p1", error: "boom" });
        harness.fakeEventBridge.emit("install:complete", { projectId: "p1" });
        harness.fakeEventBridge.emit("job:status", {
            jobId: "j1",
            referenceId: "p1",
            referenceType: "project",
            type: "scan",
            status: "completed"
        });

        expect(presenter.vm.projects[0]?.scanStatus).toBe("idle");
        expect(harness.fakeEventBridge.listenerCount("scan:progress")).toBe(0);
        expect(harness.fakeEventBridge.listenerCount("scan:complete")).toBe(0);
        expect(harness.fakeEventBridge.listenerCount("scan:failed")).toBe(0);
        expect(harness.fakeEventBridge.listenerCount("install:complete")).toBe(0);
        expect(harness.fakeEventBridge.listenerCount("job:status")).toBe(0);
    });
});

describe("ProjectListPresenter - scanAllEngines", () => {
    let harness: IProjectListPresenterTestHarness;

    beforeEach(() => {
        harness = createProjectListPresenterTestHarness();
    });

    const sampleProjects = [
        {
            id: "p1",
            name: "one",
            path: "/tmp/one",
            pmVersion: "4.1.0",
            packageManager: "yarn",
            addedAt: 1000,
            lastScannedAt: null,
            hasNodeModules: false
        },
        {
            id: "p2",
            name: "two",
            path: "/tmp/two",
            pmVersion: "4.1.0",
            packageManager: "yarn",
            addedAt: 1500,
            lastScannedAt: null,
            hasNodeModules: false
        }
    ];

    it("calls the bulk-scan endpoint with every visible project id and reloads the list", async () => {
        harness.getResult = sampleProjects;
        harness.bulkScanEnginesResult = { scannedCount: 2 };
        const presenter = harness.createPresenter();
        await presenter.load();
        harness.calls = [];

        const pending = presenter.scanAllEngines();
        expect(presenter.vm.scanningAllEngines).toBe(true);

        await pending;

        expect(presenter.vm.scanningAllEngines).toBe(false);
        const bulkScanCalls = harness.calls.filter(call => call.route === bulkScanEnginesRoute);
        expect(bulkScanCalls).toHaveLength(1);
        expect(bulkScanCalls[0]!.args).toEqual({
            params: {},
            body: { projectIds: ["p1", "p2"] }
        });
    });

    it("does nothing when there are no projects", async () => {
        harness.getResult = [];
        const presenter = harness.createPresenter();
        await presenter.load();
        harness.calls = [];

        await presenter.scanAllEngines();

        expect(harness.calls.some(call => call.route === bulkScanEnginesRoute)).toBe(false);
    });

    it("resets scanningAllEngines even when the bulk-scan request fails", async () => {
        harness.getResult = sampleProjects;
        harness.bulkScanEnginesError = new Error("bulk scan failed");
        const presenter = harness.createPresenter();
        await presenter.load();

        await presenter.scanAllEngines();

        expect(presenter.vm.scanningAllEngines).toBe(false);
    });
});
