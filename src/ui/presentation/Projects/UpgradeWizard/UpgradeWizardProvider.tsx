import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { UpgradeWizardFeature } from "./feature.js";
import type { UpgradeWizardPresenter } from "./abstractions/UpgradeWizardPresenter.js";

interface IUpgradeWizardPresenterParams {
    presenter: UpgradeWizardPresenter.Interface;
}

interface IUpgradeWizardProviderProps {
    children: (params: IUpgradeWizardPresenterParams) => React.ReactNode;
}

export function UpgradeWizardProvider({ children }: IUpgradeWizardProviderProps): React.ReactNode {
    const { presenter } = useFeature(UpgradeWizardFeature);
    return children({ presenter });
}
