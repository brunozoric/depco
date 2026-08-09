import { createFeature } from "#shared/index.js";
import { PackagesPresenter as PackagesPresenterAbstraction } from "./abstractions/PackagesPresenter.js";
import { PackagesPresenter } from "./PackagesPresenter.js";
import { PackagesUseCasesFeature } from "../useCases/feature.js";
import { ProjectsFeature } from "../../../features/Projects/feature.js";
import { ProjectsUseCasesFeature } from "../../Projects/useCases/feature.js";
import { UpgradesFeature } from "../../../features/Upgrades/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";

export interface IPackageListFeatureExports {
    presenter: PackagesPresenterAbstraction.Interface;
}

export const PackageListFeature = createFeature<void, IPackageListFeatureExports>({
    name: "Ui/PackageList",
    dependencies: [
        PackagesUseCasesFeature,
        ProjectsFeature,
        ProjectsUseCasesFeature,
        UpgradesFeature,
        WebSocketFeature,
        TeamFilterFeature
    ],
    register(container) {
        container.register(PackagesPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(PackagesPresenterAbstraction)
        };
    }
});
