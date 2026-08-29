import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { TeamsPageFeature } from "./feature.js";
import type { TeamsPresenter } from "./abstractions/TeamsPresenter.js";

interface ITeamsPresenterParams {
    presenter: TeamsPresenter.Interface;
}

interface ITeamsProviderProps {
    children: (params: ITeamsPresenterParams) => React.ReactNode;
}

export function TeamsProvider({ children }: ITeamsProviderProps): React.ReactNode {
    const { presenter } = useFeature(TeamsPageFeature);
    return children({ presenter });
}
