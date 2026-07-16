import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { DependencyGraphPageFeature } from "./feature.js";
import type { DependencyGraphPresenter } from "./abstractions/DependencyGraphPresenter.js";

interface DependencyGraphProviderProps {
    children: (params: { presenter: DependencyGraphPresenter.Interface }) => React.ReactNode;
}

export function DependencyGraphProvider({
    children
}: DependencyGraphProviderProps): React.ReactNode {
    const { presenter } = useFeature(DependencyGraphPageFeature);
    return children({ presenter });
}
