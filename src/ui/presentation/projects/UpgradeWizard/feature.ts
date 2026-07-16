import { createFeature } from "#shared/index.js";
import { UpgradeWizardPresenter as UpgradeWizardPresenterAbstraction } from "./abstractions/UpgradeWizardPresenter.js";
import { UpgradeWizardPresenter } from "./UpgradeWizardPresenter.js";
import { UpgradeSessionsGateway } from "../../../features/upgradeSessions/UpgradeSessionsGateway.js";
import { UpgradeSessionsRepository } from "../../../features/upgradeSessions/UpgradeSessionsRepository.js";
import { HTTPClientFeature } from "../../../httpClient/feature.js";
import { ProjectsFeature } from "../../../features/projects/feature.js";
import { ProjectsUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";
import { AppSettingsFeature } from "../../../features/appSettings/feature.js";

export interface IUpgradeWizardFeatureExports {
    presenter: UpgradeWizardPresenterAbstraction.Interface;
}

export const UpgradeWizardFeature = createFeature<void, IUpgradeWizardFeatureExports>({
    name: "Ui/UpgradeWizard",
    dependencies: [
        HTTPClientFeature,
        ProjectsFeature,
        ProjectsUseCasesFeature,
        WebSocketFeature,
        AppSettingsFeature
    ],
    register(container) {
        container.register(UpgradeSessionsGateway).inSingletonScope();
        container.register(UpgradeSessionsRepository).inSingletonScope();
        container.register(UpgradeWizardPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(UpgradeWizardPresenterAbstraction)
        };
    }
});
