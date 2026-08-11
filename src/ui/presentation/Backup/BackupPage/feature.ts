import { createFeature } from "#shared/index.js";
import { BackupPresenter as BackupPresenterAbstraction } from "./abstractions/BackupPresenter.js";
import { BackupPresenter } from "./BackupPresenter.js";
import { BackupUseCasesFeature } from "../useCases/feature.js";
import { BackupRoute } from "./BackupRoute.js";

export interface IBackupPresentationFeatureExports {
    presenter: BackupPresenterAbstraction.Interface;
}

export const BackupPresentationFeature = createFeature<void, IBackupPresentationFeatureExports>({
    name: "Ui/BackupPresentation",
    dependencies: [BackupUseCasesFeature],
    register(container) {
        container.register(BackupPresenter);
        container.register(BackupRoute).inSingletonScope();
    },
    resolve(container): IBackupPresentationFeatureExports {
        return {
            presenter: container.resolve(BackupPresenterAbstraction)
        };
    }
});
