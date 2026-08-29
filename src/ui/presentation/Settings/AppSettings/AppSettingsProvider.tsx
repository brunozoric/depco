import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { AppSettingsPresentationFeature } from "./feature.js";
import type { AppSettingsPresenter } from "./abstractions/AppSettingsPresenter.js";

interface IAppSettingsPresenterParams {
    presenter: AppSettingsPresenter.Interface;
}

interface IAppSettingsProviderProps {
    children: (params: IAppSettingsPresenterParams) => React.ReactNode;
}

export function AppSettingsProvider({ children }: IAppSettingsProviderProps): React.ReactNode {
    const { presenter } = useFeature(AppSettingsPresentationFeature);
    return children({ presenter });
}
