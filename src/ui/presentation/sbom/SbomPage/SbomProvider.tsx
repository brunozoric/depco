import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { SbomPageFeature } from "./feature.js";
import type { SbomPresenter } from "./abstractions/SbomPresenter.js";

interface SbomProviderProps {
    children: (params: { presenter: SbomPresenter.Interface }) => React.ReactNode;
}

export function SbomProvider({ children }: SbomProviderProps): React.ReactNode {
    const { presenter } = useFeature(SbomPageFeature);
    return children({ presenter });
}
