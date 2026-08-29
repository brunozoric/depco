import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { DependencyGraphPageFeature } from "./feature.js";
import type { DependencyGraphPresenter } from "./abstractions/DependencyGraphPresenter.js";

interface IDependencyGraphPresenterParams {
    presenter: DependencyGraphPresenter.Interface;
}

interface IDependencyGraphProviderProps {
    children: (params: IDependencyGraphPresenterParams) => React.ReactNode;
}

export function DependencyGraphProvider({
    children
}: IDependencyGraphProviderProps): React.ReactNode {
    const { presenter } = useFeature(DependencyGraphPageFeature);
    return children({ presenter });
}
