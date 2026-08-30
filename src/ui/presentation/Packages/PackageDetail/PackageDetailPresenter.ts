import { computed, makeAutoObservable, runInAction } from "mobx";
import { getErrorMessage } from "#shared/index.js";
import { PackageDetailPresenter as Abstraction } from "./abstractions/PackageDetailPresenter.js";
import { PackagesGateway } from "../../../features/Packages/abstractions/PackagesGateway.js";
import { VulnerabilitiesGateway } from "../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import { LicensesGateway } from "../../../features/Licenses/abstractions/LicensesGateway.js";
import { ChangelogsGateway } from "../../../features/Changelogs/abstractions/ChangelogsGateway.js";
import { compareVersions } from "#ui/infrastructure/Shared/versionCompare.js";

function findMinCurrentVersion(projects: PackagesGateway.PackageDetailProject[]): string | null {
    return projects.reduce<string | null>((min, project) => {
        if (min === null || compareVersions(project.currentVersion, min) < 0) {
            return project.currentVersion;
        }
        return min;
    }, null);
}

class PackageDetailPresenterImpl implements Abstraction.Interface {
    private loading = false;
    private error: string | null = null;
    private packageDetail: PackagesGateway.PackageDetail | null = null;
    private changelogs: PackagesGateway.ChangelogEntry[] = [];
    private changelogsResolving = false;
    private vulnerabilities: VulnerabilitiesGateway.VulnerabilityItem[] = [];
    private licenses: LicensesGateway.LicenseItem[] = [];
    private packageName: string | null = null;

    public constructor(
        private readonly packagesGateway: PackagesGateway.Interface,
        private readonly vulnerabilitiesGateway: VulnerabilitiesGateway.Interface,
        private readonly licensesGateway: LicensesGateway.Interface,
        private readonly changelogsGateway: ChangelogsGateway.Interface
    ) {
        makeAutoObservable(this, { vm: computed });
    }

    public get vm(): Abstraction.ViewModel {
        return {
            loading: this.loading,
            error: this.error,
            packageDetail: this.packageDetail,
            changelogs: this.changelogs,
            changelogsResolving: this.changelogsResolving,
            vulnerabilities: this.vulnerabilities,
            licenses: this.licenses
        };
    }

    public load = async (packageName: string): Promise<void> => {
        this.packageName = packageName;
        this.loading = true;
        this.error = null;
        try {
            const packageDetail = await this.packagesGateway.getPackageDetail(packageName);
            runInAction(() => {
                this.packageDetail = packageDetail;
            });

            await Promise.all([
                this.loadChangelogs(packageDetail),
                this.loadVulnerabilities(packageName),
                this.loadLicenses(packageName)
            ]);
        } catch (error) {
            runInAction(() => {
                this.error = getErrorMessage(error, "Failed to load package detail");
            });
        } finally {
            runInAction(() => {
                this.loading = false;
            });
        }
    };

    public reResolveChangelogs = async (): Promise<void> => {
        if (!this.packageName || !this.packageDetail) {
            return;
        }

        const from = findMinCurrentVersion(this.packageDetail.projects);
        const to = this.packageDetail.latestVersion;
        if (!from || !to) {
            return;
        }

        runInAction(() => {
            this.changelogsResolving = true;
        });

        try {
            const result = await this.changelogsGateway.reResolveChangelogs(
                this.packageName,
                from,
                to
            );
            runInAction(() => {
                this.changelogs = result.entries;
                this.changelogsResolving = result.resolving;
            });
        } finally {
            runInAction(() => {
                this.changelogsResolving = false;
            });
        }
    };

    public dispose = (): void => {
        this.packageDetail = null;
        this.changelogs = [];
        this.vulnerabilities = [];
        this.licenses = [];
        this.packageName = null;
    };

    private loadChangelogs = async (
        packageDetail: PackagesGateway.PackageDetail
    ): Promise<void> => {
        const from = findMinCurrentVersion(packageDetail.projects);
        const to = packageDetail.latestVersion;
        if (!from || !to) {
            return;
        }

        const result = await this.changelogsGateway.getChangelogs(packageDetail.name, from, to);
        runInAction(() => {
            this.changelogs = result.entries;
            this.changelogsResolving = result.resolving;
        });
    };

    private loadVulnerabilities = async (packageName: string): Promise<void> => {
        const response = await this.vulnerabilitiesGateway.list({ packageName });
        runInAction(() => {
            this.vulnerabilities = response.items;
        });
    };

    private loadLicenses = async (packageName: string): Promise<void> => {
        const response = await this.licensesGateway.list({ packageName });
        runInAction(() => {
            this.licenses = response.items;
        });
    };
}

export const PackageDetailPresenter = Abstraction.createImplementation({
    implementation: PackageDetailPresenterImpl,
    dependencies: [PackagesGateway, VulnerabilitiesGateway, LicensesGateway, ChangelogsGateway]
});
