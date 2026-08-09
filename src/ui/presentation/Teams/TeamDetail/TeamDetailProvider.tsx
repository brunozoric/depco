import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { TeamDetailFeature } from "./feature.js";
import type { TeamDetailPresenter } from "./abstractions/TeamDetailPresenter.js";

interface TeamDetailProviderProps {
    children: (params: { presenter: TeamDetailPresenter.Interface }) => React.ReactNode;
}

export function TeamDetailProvider({ children }: TeamDetailProviderProps): React.ReactNode {
    const { presenter } = useFeature(TeamDetailFeature);
    return children({ presenter });
}
