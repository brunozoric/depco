import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { TeamsPageFeature } from "./feature.js";
import type { TeamsPresenter } from "./abstractions/TeamsPresenter.js";

interface TeamsProviderProps {
    children: (params: { presenter: TeamsPresenter.Interface }) => React.ReactNode;
}

export function TeamsProvider({ children }: TeamsProviderProps): React.ReactNode {
    const { presenter } = useFeature(TeamsPageFeature);
    return children({ presenter });
}
