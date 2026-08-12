import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    createProjectDetailTestContext,
    type ProjectDetailTestContext
} from "./ProjectDetailPresenter.testHelpers.js";
import {
    updateAutoFixSettingsRoute,
    generateAutoFixPrRoute,
    getProjectAutoFixPullRequestsRoute,
    setProjectTeamsRoute
} from "#shared/routes/index.js";

describe("ProjectDetailPresenter - auto-fix, sbom export, and teams", () => {
    let ctx: ProjectDetailTestContext;

    beforeEach(() => {
        ctx = createProjectDetailTestContext();
    });

    describe("auto-fix", () => {
        it("loads auto-fix settings into the view model", async () => {
            const presenter = ctx.createPresenter();

            await ctx.loadAndFlush(presenter, "p1");

            expect(presenter.vm.autoFixSettings).toEqual({
                enabled: false,
                upgradeTypes: ["patch", "minor"],
                groupingStrategy: "single",
                branchPrefix: "auto-fix/"
            });
        });

        it("loads the auto-fix pull request list into the view model", async () => {
            const presenter = ctx.createPresenter();
            ctx.autoFixPullRequestsResult = [
                {
                    id: "pr-1",
                    projectId: "p1",
                    packageNames: ["left-pad"],
                    fromVersions: { "left-pad": "1.0.0" },
                    toVersions: { "left-pad": "1.2.0" },
                    upgradeType: "minor",
                    branchName: "auto-fix/left-pad-1.2.0",
                    prUrl: "https://example.com/pr/1",
                    prNumber: 1,
                    status: "open",
                    licenseWarnings: [],
                    createdAt: 0,
                    updatedAt: 0
                }
            ];

            await ctx.loadAndFlush(presenter, "p1");

            expect(presenter.vm.autoFixPullRequests).toEqual([
                {
                    id: "pr-1",
                    packageNames: ["left-pad"],
                    fromVersions: { "left-pad": "1.0.0" },
                    toVersions: { "left-pad": "1.2.0" },
                    upgradeType: "minor",
                    branchName: "auto-fix/left-pad-1.2.0",
                    prUrl: "https://example.com/pr/1",
                    prNumber: 1,
                    status: "open",
                    licenseWarnings: []
                }
            ]);
        });

        it("updateAutoFixSettings calls the gateway and reflects the change in the view model", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.calls = [];

            await presenter.updateAutoFixSettings({ enabled: true });

            expect(ctx.calls).toEqual([
                {
                    route: updateAutoFixSettingsRoute,
                    args: { params: { projectId: "p1" }, body: { enabled: true } }
                }
            ]);
            expect(presenter.vm.autoFixSettings?.enabled).toBe(true);
        });

        it("updateAutoFixSettings is a no-op without a loaded project", async () => {
            const presenter = ctx.createPresenter();

            await presenter.updateAutoFixSettings({ enabled: true });

            expect(ctx.calls.some(c => c.route === updateAutoFixSettingsRoute)).toBe(false);
        });

        it("generateAutoFixPrs sets autoFixRunning while in flight and refreshes the PR list", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.calls = [];
            ctx.autoFixPullRequestsResult = [
                {
                    id: "pr-2",
                    projectId: "p1",
                    packageNames: ["chalk"],
                    fromVersions: { chalk: "4.0.0" },
                    toVersions: { chalk: "5.0.0" },
                    upgradeType: "major",
                    branchName: "auto-fix/chalk-5.0.0",
                    prUrl: null,
                    prNumber: null,
                    status: "pending",
                    licenseWarnings: [],
                    createdAt: 0,
                    updatedAt: 0
                }
            ];

            const pending = presenter.generateAutoFixPrs();
            expect(presenter.vm.autoFixRunning).toBe(true);
            await pending;

            expect(presenter.vm.autoFixRunning).toBe(false);
            expect(ctx.calls.some(c => c.route === generateAutoFixPrRoute)).toBe(true);
            expect(ctx.calls.some(c => c.route === getProjectAutoFixPullRequestsRoute)).toBe(true);
            expect(presenter.vm.autoFixPullRequests).toHaveLength(1);
            expect(presenter.vm.autoFixPullRequests[0]?.id).toBe("pr-2");
        });

        it("generateAutoFixPrs is a no-op without a loaded project", async () => {
            const presenter = ctx.createPresenter();

            await presenter.generateAutoFixPrs();

            expect(ctx.calls.some(c => c.route === generateAutoFixPrRoute)).toBe(false);
            expect(presenter.vm.autoFixRunning).toBe(false);
        });
    });

    describe("exportSbom", () => {
        beforeEach(() => {
            // downloadBlob() reaches into the DOM to trigger a file download; this
            // suite runs without jsdom, so a minimal anchor/document stub is provided.
            vi.stubGlobal("document", {
                createElement: () => ({
                    href: "",
                    download: "",
                    click: () => {},
                    remove: () => {}
                }),
                body: {
                    appendChild: () => {}
                }
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it("exports the project SBOM in the requested format and triggers a download", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.sbomExportResult = {
                blob: new Blob(["cyclonedx-content"]),
                filename: "p1-sbom.json"
            };

            await presenter.exportSbom("cyclonedx");

            expect(ctx.sbomExportCalls).toEqual([{ projectId: "p1", format: "cyclonedx" }]);
            expect(presenter.vm.exportingSbom).toBe(false);
            expect(presenter.vm.sbomExportError).toBeNull();
        });

        it("sets exportingSbom true while the export is in flight, then false", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");

            const pending = presenter.exportSbom("spdx");
            expect(presenter.vm.exportingSbom).toBe(true);
            await pending;

            expect(presenter.vm.exportingSbom).toBe(false);
        });

        it("captures the error message when the export fails", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.sbomExportShouldFail = new Error("export failed");

            await presenter.exportSbom("cyclonedx");

            expect(presenter.vm.sbomExportError).toBe("export failed");
            expect(presenter.vm.exportingSbom).toBe(false);
        });

        it("clears a previous export error when a new export succeeds", async () => {
            const presenter = ctx.createPresenter();
            await ctx.loadAndFlush(presenter, "p1");
            ctx.sbomExportShouldFail = new Error("export failed");
            await presenter.exportSbom("cyclonedx");
            expect(presenter.vm.sbomExportError).toBe("export failed");

            ctx.sbomExportShouldFail = null;
            await presenter.exportSbom("cyclonedx");

            expect(presenter.vm.sbomExportError).toBeNull();
        });

        it("is a no-op without a loaded project", async () => {
            const presenter = ctx.createPresenter();

            await presenter.exportSbom("cyclonedx");

            expect(ctx.sbomExportCalls).toEqual([]);
            expect(presenter.vm.exportingSbom).toBe(false);
        });
    });

    describe("teams", () => {
        it("loads the project's assigned teams and the available team options on load", async () => {
            const presenter = ctx.createPresenter();
            ctx.teamsListResult = [
                {
                    id: "team-1",
                    name: "Platform",
                    color: "#ff0000",
                    createdAt: 0,
                    projectCount: 1,
                    vulnerabilityCount: 0,
                    compliantPercent: 100,
                    averageHealthScore: 100
                }
            ];
            ctx.projectTeamsResult = [{ id: "team-1", name: "Platform", color: "#ff0000" }];

            await ctx.loadAndFlush(presenter, "p1");

            expect(presenter.vm.projectTeamIds).toEqual(["team-1"]);
            expect(presenter.vm.availableTeams).toEqual([
                { id: "team-1", name: "Platform", color: "#ff0000" }
            ]);
        });

        it("setProjectTeams persists the selection and refreshes the assigned team IDs", async () => {
            const presenter = ctx.createPresenter();
            ctx.teamsListResult = [
                {
                    id: "team-1",
                    name: "Platform",
                    color: "#ff0000",
                    createdAt: 0,
                    projectCount: 1,
                    vulnerabilityCount: 0,
                    compliantPercent: 100,
                    averageHealthScore: 100
                },
                {
                    id: "team-2",
                    name: "Growth",
                    color: "#00ff00",
                    createdAt: 0,
                    projectCount: 1,
                    vulnerabilityCount: 0,
                    compliantPercent: 100,
                    averageHealthScore: 100
                }
            ];
            await ctx.loadAndFlush(presenter, "p1");
            expect(presenter.vm.projectTeamIds).toEqual([]);

            await presenter.setProjectTeams(["team-1", "team-2"]);

            expect(ctx.calls.some(c => c.route === setProjectTeamsRoute)).toBe(true);
            expect(presenter.vm.projectTeamIds).toEqual(["team-1", "team-2"]);
        });

        it("setProjectTeams is a no-op without a loaded project", async () => {
            const presenter = ctx.createPresenter();

            await presenter.setProjectTeams(["team-1"]);

            expect(ctx.calls.some(c => c.route === setProjectTeamsRoute)).toBe(false);
        });
    });

    it("showMaintenance defaults to true and toggleMaintenance flips it", () => {
        const presenter = ctx.createPresenter();

        expect(presenter.vm.showMaintenance).toBe(true);

        presenter.toggleMaintenance();

        expect(presenter.vm.showMaintenance).toBe(false);

        presenter.toggleMaintenance();

        expect(presenter.vm.showMaintenance).toBe(true);
    });
});
