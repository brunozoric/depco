import { createFeature } from "#shared/index.js";
import { SbomPresenter as SbomPresenterAbstraction } from "./abstractions/SbomPresenter.js";
import { SbomPresenter } from "./SbomPresenter.js";
import { SbomUseCasesFeature } from "../useCases/feature.js";
import { SbomFeature } from "../../../features/Sbom/feature.js";
import { ProjectsFeature } from "../../../features/Projects/feature.js";
import { ProjectsUseCasesFeature } from "../../Projects/useCases/feature.js";

export interface ISbomPageFeatureExports {
    presenter: SbomPresenterAbstraction.Interface;
}

export const SbomPageFeature = createFeature<void, ISbomPageFeatureExports>({
    name: "Ui/SbomPage",
    dependencies: [SbomUseCasesFeature, SbomFeature, ProjectsFeature, ProjectsUseCasesFeature],
    register(container) {
        container.register(SbomPresenter);
    },
    resolve(container) {
        return {
            presenter: container.resolve(SbomPresenterAbstraction)
        };
    }
});
