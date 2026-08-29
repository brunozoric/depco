import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { PmSettingsPresentationFeature } from "./feature.js";
import type { PmSettingsPresenter } from "./abstractions/PmSettingsPresenter.js";

interface IPmSettingsPresenterParams {
    presenter: PmSettingsPresenter.Interface;
}

interface IPmSettingsProviderProps {
    children: (params: IPmSettingsPresenterParams) => React.ReactNode;
}

export function PmSettingsProvider({ children }: IPmSettingsProviderProps): React.ReactNode {
    const { presenter } = useFeature(PmSettingsPresentationFeature);
    return children({ presenter });
}
