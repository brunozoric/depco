import { createFeature } from "#shared/index.js";
import { LicensesPresenter as LicensesPresenterAbstraction } from "./abstractions/LicensesPresenter.js";
import { LicensesPresenter } from "./LicensesPresenter.js";
import { LicensesUseCasesFeature } from "../useCases/feature.js";
import { LicensesFeature } from "../../../features/Licenses/feature.js";
import { WebSocketFeature } from "../../../websocket/feature.js";
import { ProjectsFeature } from "../../../features/Projects/feature.js";
import { ProjectsUseCasesFeature } from "../../projects/useCases/feature.js";
import { TeamFilterFeature } from "../../../features/TeamFilter/feature.js";
import { UrlFilterFeature } from "../../../features/UrlFilter/feature.js";

export interface ILicenseListFeatureExports {
    presenter: LicensesPresenterAbstraction.Interface;
}

export const LicenseListFeature = createFeature<void, ILicenseListFeatureExports>({
    name: "Ui/LicenseList",
    dependencies: [
        LicensesUseCasesFeature,
        LicensesFeature,
        WebSocketFeature,
        ProjectsFeature,
        ProjectsUseCasesFeature,
        TeamFilterFeature,
        UrlFilterFeature
    ],
    register(container) {
        container.register(LicensesPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(LicensesPresenterAbstraction)
        };
    }
});
