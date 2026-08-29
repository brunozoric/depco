import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { TrendsPageFeature } from "./feature.js";
import type { TrendsPresenter } from "./abstractions/TrendsPresenter.js";

interface ITrendsPresenterParams {
    presenter: TrendsPresenter.Interface;
}

interface ITrendsProviderProps {
    children: (params: ITrendsPresenterParams) => React.ReactNode;
}

export function TrendsProvider({ children }: ITrendsProviderProps): React.ReactNode {
    const { presenter } = useFeature(TrendsPageFeature);
    return children({ presenter });
}
