import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { AppSettingsPresentationFeature } from "./feature.js";
import type { AppSettingsPresenter } from "./abstractions/AppSettingsPresenter.js";

interface AppSettingsProviderProps {
    children: (params: { presenter: AppSettingsPresenter.Interface }) => React.ReactNode;
}

export function AppSettingsProvider({ children }: AppSettingsProviderProps): React.ReactNode {
    const { presenter } = useFeature(AppSettingsPresentationFeature);
    return children({ presenter });
}
