import { createFeature } from "#shared/index.js";
import { PackageDetailPresenter as PackageDetailPresenterAbstraction } from "./abstractions/PackageDetailPresenter.js";
import { PackageDetailPresenter } from "./PackageDetailPresenter.js";
import { PackagesFeature } from "../../../features/Packages/feature.js";
import { VulnerabilitiesFeature } from "../../../features/Vulnerabilities/feature.js";
import { LicensesFeature } from "../../../features/Licenses/feature.js";
import { PackageDetailRoute } from "./PackageDetailRoute.js";

export interface IPackageDetailFeatureExports {
    presenter: PackageDetailPresenterAbstraction.Interface;
}

export const PackageDetailFeature = createFeature<void, IPackageDetailFeatureExports>({
    name: "Ui/PackageDetail",
    dependencies: [PackagesFeature, VulnerabilitiesFeature, LicensesFeature],
    register(container) {
        container.register(PackageDetailPresenter);
        container.register(PackageDetailRoute).inSingletonScope();
    },
    resolve(container) {
        return {
            presenter: container.resolve(PackageDetailPresenterAbstraction)
        };
    }
});
