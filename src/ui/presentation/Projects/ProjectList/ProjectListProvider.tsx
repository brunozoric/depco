import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { ProjectListFeature } from "./feature.js";
import type { ProjectListPresenter } from "./abstractions/ProjectListPresenter.js";

interface ProjectListProviderProps {
    children: (params: { presenter: ProjectListPresenter.Interface }) => React.ReactNode;
}

export function ProjectListProvider({ children }: ProjectListProviderProps): React.ReactNode {
    const { presenter } = useFeature(ProjectListFeature);
    return children({ presenter });
}
