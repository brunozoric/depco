import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { TeamDetailFeature } from "./feature.js";
import type { TeamDetailPresenter } from "./abstractions/TeamDetailPresenter.js";

interface ITeamDetailPresenterParams {
    presenter: TeamDetailPresenter.Interface;
}

interface ITeamDetailProviderProps {
    children: (params: ITeamDetailPresenterParams) => React.ReactNode;
}

export function TeamDetailProvider({ children }: ITeamDetailProviderProps): React.ReactNode {
    const { presenter } = useFeature(TeamDetailFeature);
    return children({ presenter });
}
