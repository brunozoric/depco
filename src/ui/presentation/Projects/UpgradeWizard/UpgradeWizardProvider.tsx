import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { UpgradeWizardFeature } from "./feature.js";
import type { UpgradeWizardPresenter } from "./abstractions/UpgradeWizardPresenter.js";

interface UpgradeWizardProviderProps {
    children: (params: { presenter: UpgradeWizardPresenter.Interface }) => React.ReactNode;
}

export function UpgradeWizardProvider({ children }: UpgradeWizardProviderProps): React.ReactNode {
    const { presenter } = useFeature(UpgradeWizardFeature);
    return children({ presenter });
}
