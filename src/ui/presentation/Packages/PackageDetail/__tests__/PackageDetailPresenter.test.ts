import { describe, it, expect, beforeEach } from "vitest";
import type { Container } from "@webiny/di";
import { createContainer } from "#shared/index.js";
import { PackagesGateway } from "../../../../features/Packages/abstractions/PackagesGateway.js";
import { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import { LicensesGateway } from "../../../../features/Licenses/abstractions/LicensesGateway.js";
import { PackageDetailPresenter } from "../abstractions/PackageDetailPresenter.js";
import { PackageDetailPresenter as PackageDetailPresenterRegistration } from "../PackageDetailPresenter.js";

interface RecordedCall {
    method: string;
    args: unknown[];
}

const packageDetail: PackagesGateway.PackageDetail = {
    name: "left-pad",
    repoUrl: "https://github.com/left-pad/left-pad",
    projects: [
        {
            projectId: "p1",
            projectName: "project-one",
            currentVersion: "1.5.0",
            latestVersion: "2.0.0",
            upgradeType: "major",
            dependencyKind: "dependency"
        },
        {
            projectId: "p2",
            projectName: "project-two",
            currentVersion: "1.0.0",
            latestVersion: "2.0.0",
            upgradeType: "major",
            dependencyKind: "dependency"
        }
    ],
    latestVersion: "2.0.0",
    lastPublishedAt: 1000,
    registryResolved: true
};

const changelogEntries: PackagesGateway.ChangelogEntry[] = [
    { version: "2.0.0", content: "breaking changes", source: "github" }
];

const vulnerabilityItems: VulnerabilitiesGateway.VulnerabilityItem[] = [
    {
        id: "v1",
        projectId: "p1",
        projectName: "project-one",
        packageName: "left-pad",
        severity: "high",
        title: "Some vulnerability",
        advisoryUrl: null,
        cveId: null,
        vulnerableRange: null,
        fixVersion: "2.0.0",
        source: "osv",
        installedVersion: "1.5.0",
        dependencyKind: "dependency",
        scannedAt: 1000,
        dismissedAt: null,
        dismissedUntil: null
    }
];

const licenseItems: LicensesGateway.LicenseItem[] = [
    {
        id: "l1",
        projectId: "p1",
        packageName: "left-pad",
        licenseName: "MIT",
        spdxId: "MIT",
        source: "registry",
        riskTier: "permissive",
        licenseUrl: null,
        scannedAt: 1000
    }
];

describe("PackageDetailPresenter", () => {
    let calls: RecordedCall[];

    function createPresenter(overrides?: {
        getPackageDetail?: () => Promise<PackagesGateway.PackageDetail>;
    }): PackageDetailPresenter.Interface {
        const container: Container = createContainer();

        container.registerInstance(PackagesGateway, {
            list: async () => ({ items: [], total: 0 }),
            rescanPackage: async () => {},
            getPackageDetail: async (packageName: string) => {
                calls.push({ method: "getPackageDetail", args: [packageName] });
                return overrides?.getPackageDetail ? overrides.getPackageDetail() : packageDetail;
            },
            getChangelogs: async (packageName: string, from: string, to: string) => {
                calls.push({ method: "getChangelogs", args: [packageName, from, to] });
                return { entries: changelogEntries, resolving: false };
            },
            reResolveChangelogs: async (packageName: string, from: string, to: string) => {
                calls.push({ method: "reResolveChangelogs", args: [packageName, from, to] });
                return { entries: changelogEntries, resolving: true };
            }
        } satisfies PackagesGateway.Interface);

        container.registerInstance(VulnerabilitiesGateway, {
            list: async filters => {
                calls.push({ method: "vulnerabilities.list", args: [filters] });
                return { items: vulnerabilityItems, total: vulnerabilityItems.length };
            }
        } as VulnerabilitiesGateway.Interface);

        container.registerInstance(LicensesGateway, {
            list: async filters => {
                calls.push({ method: "licenses.list", args: [filters] });
                return { items: licenseItems, total: licenseItems.length };
            }
        } as LicensesGateway.Interface);

        container.register(PackageDetailPresenterRegistration);

        return container.resolve(PackageDetailPresenter);
    }

    beforeEach(() => {
        calls = [];
    });

    it("load() fetches package detail, changelogs, vulnerabilities, and licenses", async () => {
        const presenter = createPresenter();

        await presenter.load("left-pad");

        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.error).toBeNull();
        expect(presenter.vm.packageDetail).toEqual(packageDetail);
        expect(presenter.vm.changelogs).toEqual(changelogEntries);
        expect(presenter.vm.changelogsResolving).toBe(false);
        expect(presenter.vm.vulnerabilities).toEqual(vulnerabilityItems);
        expect(presenter.vm.licenses).toEqual(licenseItems);

        expect(calls).toContainEqual({ method: "getPackageDetail", args: ["left-pad"] });
        expect(calls).toContainEqual({
            method: "getChangelogs",
            args: ["left-pad", "1.0.0", "2.0.0"]
        });
        expect(calls).toContainEqual({
            method: "vulnerabilities.list",
            args: [{ packageName: "left-pad" }]
        });
        expect(calls).toContainEqual({
            method: "licenses.list",
            args: [{ packageName: "left-pad" }]
        });
    });

    it("load() sets error when the package detail request fails", async () => {
        const presenter = createPresenter({
            getPackageDetail: async () => {
                throw new Error("boom");
            }
        });

        await presenter.load("left-pad");

        expect(presenter.vm.loading).toBe(false);
        expect(presenter.vm.error).toBe("boom");
        expect(presenter.vm.packageDetail).toBeNull();
    });

    it("reResolveChangelogs() re-resolves using the min current version and latest version", async () => {
        const presenter = createPresenter();
        await presenter.load("left-pad");
        calls = [];

        await presenter.reResolveChangelogs();

        expect(calls).toEqual([
            { method: "reResolveChangelogs", args: ["left-pad", "1.0.0", "2.0.0"] }
        ]);
        expect(presenter.vm.changelogs).toEqual(changelogEntries);
        expect(presenter.vm.changelogsResolving).toBe(false);
    });

    it("dispose() clears loaded state", async () => {
        const presenter = createPresenter();
        await presenter.load("left-pad");

        presenter.dispose();

        expect(presenter.vm.packageDetail).toBeNull();
        expect(presenter.vm.changelogs).toEqual([]);
        expect(presenter.vm.vulnerabilities).toEqual([]);
        expect(presenter.vm.licenses).toEqual([]);
    });
});
