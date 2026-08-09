import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { DashboardPresentationFeature } from "./feature.js";
import type { DashboardPresenter } from "./abstractions/DashboardPresenter.js";

interface DashboardProviderProps {
    children: (params: { presenter: DashboardPresenter.Interface }) => React.ReactNode;
}

export function DashboardProvider({ children }: DashboardProviderProps): React.ReactNode {
    const { presenter } = useFeature(DashboardPresentationFeature);
    return children({ presenter });
}
