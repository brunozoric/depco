import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { SbomPageFeature } from "./feature.js";
import type { SbomPresenter } from "./abstractions/SbomPresenter.js";

interface ISbomPresenterParams {
    presenter: SbomPresenter.Interface;
}

interface ISbomProviderProps {
    children: (params: ISbomPresenterParams) => React.ReactNode;
}

export function SbomProvider({ children }: ISbomProviderProps): React.ReactNode {
    const { presenter } = useFeature(SbomPageFeature);
    return children({ presenter });
}
