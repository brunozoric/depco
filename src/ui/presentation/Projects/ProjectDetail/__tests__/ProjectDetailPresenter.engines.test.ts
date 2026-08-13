import { describe, it, expect, beforeEach } from "vitest";
import { scanProjectEnginesRoute } from "#shared/routes/index.js";
import {
    createProjectDetailTestContext,
    type ProjectDetailTestContext
} from "./ProjectDetailPresenter.testHelpers.js";

describe("ProjectDetailPresenter - scanEngines", () => {
    let ctx: ProjectDetailTestContext;

    beforeEach(() => {
        ctx = createProjectDetailTestContext();
    });

    it("does nothing when no project has been loaded", async () => {
        const presenter = ctx.createPresenter();

        await presenter.scanEngines();

        expect(ctx.calls.some(call => call.route === scanProjectEnginesRoute)).toBe(false);
    });

    it("scans the loaded project's engines and reloads engine data", async () => {
        const presenter = ctx.createPresenter();
        await ctx.loadAndFlush(presenter, "p1");
        ctx.engineChecksResult = [
            {
                id: "check-1",
                projectId: "p1",
                packageName: "",
                enginesNode: ">=20",
                minimumMajor: 20,
                status: "current",
                eolDate: null,
                scannedAt: Date.now()
            }
        ];
        ctx.calls = [];

        const pending = presenter.scanEngines();
        expect(presenter.vm.engineScanning).toBe(true);

        await pending;

        expect(presenter.vm.engineScanning).toBe(false);
        const scanCalls = ctx.calls.filter(call => call.route === scanProjectEnginesRoute);
        expect(scanCalls).toHaveLength(1);
        expect(scanCalls[0]!.args).toEqual({ params: { projectId: "p1" }, query: {} });
        expect(presenter.vm.engineData?.rootStatus).toBe("current");
    });

    it("resets scanning even when the scan request fails", async () => {
        const presenter = ctx.createPresenter();
        await ctx.loadAndFlush(presenter, "p1");
        ctx.engineScanError = new Error("scan failed");

        await presenter.scanEngines();

        expect(presenter.vm.engineScanning).toBe(false);
    });
});
