import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { ProjectDetailFeature } from "./feature.js";
import type { ProjectDetailPresenter } from "./abstractions/ProjectDetailPresenter.js";

interface IProjectDetailPresenterParams {
    presenter: ProjectDetailPresenter.Interface;
}

interface IProjectDetailProviderProps {
    children: (params: IProjectDetailPresenterParams) => React.ReactNode;
}

export function ProjectDetailProvider({ children }: IProjectDetailProviderProps): React.ReactNode {
    const { presenter } = useFeature(ProjectDetailFeature);
    return children({ presenter });
}
