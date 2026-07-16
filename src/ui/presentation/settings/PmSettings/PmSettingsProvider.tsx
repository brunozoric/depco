import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { PmSettingsPresentationFeature } from "./feature.js";
import type { PmSettingsPresenter } from "./abstractions/PmSettingsPresenter.js";

interface PmSettingsProviderProps {
    children: (params: { presenter: PmSettingsPresenter.Interface }) => React.ReactNode;
}

export function PmSettingsProvider({ children }: PmSettingsProviderProps): React.ReactNode {
    const { presenter } = useFeature(PmSettingsPresentationFeature);
    return children({ presenter });
}
