import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { ProjectDetailFeature } from "./feature.js";
import type { ProjectDetailPresenter } from "./abstractions/ProjectDetailPresenter.js";

interface ProjectDetailProviderProps {
    children: (params: { presenter: ProjectDetailPresenter.Interface }) => React.ReactNode;
}

export function ProjectDetailProvider({ children }: ProjectDetailProviderProps): React.ReactNode {
    const { presenter } = useFeature(ProjectDetailFeature);
    return children({ presenter });
}
