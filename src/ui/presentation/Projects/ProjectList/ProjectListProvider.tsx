import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { ProjectListFeature } from "./feature.js";
import type { ProjectListPresenter } from "./abstractions/ProjectListPresenter.js";

interface IProjectListPresenterParams {
    presenter: ProjectListPresenter.Interface;
}

interface IProjectListProviderProps {
    children: (params: IProjectListPresenterParams) => React.ReactNode;
}

export function ProjectListProvider({ children }: IProjectListProviderProps): React.ReactNode {
    const { presenter } = useFeature(ProjectListFeature);
    return children({ presenter });
}
