import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { DashboardPresentationFeature } from "./feature.js";
import type { DashboardPresenter } from "./abstractions/DashboardPresenter.js";

interface IDashboardPresenterParams {
    presenter: DashboardPresenter.Interface;
}

interface IDashboardProviderProps {
    children: (params: IDashboardPresenterParams) => React.ReactNode;
}

export function DashboardProvider({ children }: IDashboardProviderProps): React.ReactNode {
    const { presenter } = useFeature(DashboardPresentationFeature);
    return children({ presenter });
}
