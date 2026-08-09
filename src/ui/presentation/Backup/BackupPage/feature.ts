import { createFeature } from "#shared/index.js";
import { BackupPresenter as BackupPresenterAbstraction } from "./abstractions/BackupPresenter.js";
import { BackupPresenter } from "./BackupPresenter.js";
import { BackupUseCasesFeature } from "../useCases/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { BackupRoute as BackupRouteAbstraction } from "./abstractions/BackupRoute.js";
import { BackupRoute } from "./BackupRoute.js";

export interface IBackupPresentationFeatureExports {
    presenter: BackupPresenterAbstraction.Interface;
}

export const BackupPresentationFeature = createFeature<void, IBackupPresentationFeatureExports>({
    name: "Ui/BackupPresentation",
    dependencies: [RouterFeature, BackupUseCasesFeature],
    register(container) {
        container.register(BackupPresenter);
        container.register(BackupRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(BackupRouteAbstraction));
    },
    resolve(container): IBackupPresentationFeatureExports {
        return {
            presenter: container.resolve(BackupPresenterAbstraction)
        };
    }
});
