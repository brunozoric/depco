import { createAbstraction } from "#shared/index.js";
import type { PackagesGateway } from "../../../../features/Packages/abstractions/PackagesGateway.js";
import type { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";
import type { LicensesGateway } from "../../../../features/Licenses/abstractions/LicensesGateway.js";

export interface IPackageDetailViewModel {
    loading: boolean;
    error: string | null;
    packageDetail: PackagesGateway.PackageDetail | null;
    changelogs: PackagesGateway.ChangelogEntry[];
    changelogsResolving: boolean;
    vulnerabilities: VulnerabilitiesGateway.VulnerabilityItem[];
    licenses: LicensesGateway.LicenseItem[];
}

export interface IPackageDetailPresenter {
    get vm(): IPackageDetailViewModel;
    load: (packageName: string) => Promise<void>;
    reResolveChangelogs: () => Promise<void>;
    dispose: () => void;
}

export const PackageDetailPresenter = createAbstraction<IPackageDetailPresenter>(
    "Ui/PackageDetailPresenter"
);

export namespace PackageDetailPresenter {
    export type Interface = IPackageDetailPresenter;
    export type ViewModel = IPackageDetailViewModel;
}
