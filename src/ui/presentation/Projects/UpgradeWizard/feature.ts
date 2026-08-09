import { createFeature } from "#shared/index.js";
import { UpgradeWizardPresenter as UpgradeWizardPresenterAbstraction } from "./abstractions/UpgradeWizardPresenter.js";
import { UpgradeWizardPresenter } from "./UpgradeWizardPresenter.js";
import { UpgradeSessionsGateway } from "../../../features/UpgradeSessions/UpgradeSessionsGateway.js";
import { UpgradeSessionsRepository } from "../../../features/UpgradeSessions/UpgradeSessionsRepository.js";
import { HTTPClientFeature } from "../../../infrastructure/HttpClient/feature.js";
import { ProjectsFeature } from "../../../features/Projects/feature.js";
import { ProjectsUseCasesFeature } from "../useCases/feature.js";
import { WebSocketFeature } from "../../../infrastructure/WebSocket/feature.js";
import { AppSettingsFeature } from "../../../features/AppSettings/feature.js";
import { RouterFeature } from "../../../infrastructure/Router/feature.js";
import { RouteRegistry } from "../../../infrastructure/Router/abstractions/RouteRegistry.js";
import { UpgradeWizardRoute as UpgradeWizardRouteAbstraction } from "./abstractions/UpgradeWizardRoute.js";
import { UpgradeWizardRoute } from "./UpgradeWizardRoute.js";

export interface IUpgradeWizardFeatureExports {
    presenter: UpgradeWizardPresenterAbstraction.Interface;
}

export const UpgradeWizardFeature = createFeature<void, IUpgradeWizardFeatureExports>({
    name: "Ui/UpgradeWizard",
    dependencies: [
        RouterFeature,
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
        container.register(UpgradeWizardRoute).inSingletonScope();
        const registry = container.resolve(RouteRegistry);
        registry.register(container.resolve(UpgradeWizardRouteAbstraction));
    },
    resolve(container) {
        return {
            presenter: container.resolve(UpgradeWizardPresenterAbstraction)
        };
    }
});
