import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { TrendsPageFeature } from "./feature.js";
import type { TrendsPresenter } from "./abstractions/TrendsPresenter.js";

interface TrendsProviderProps {
    children: (params: { presenter: TrendsPresenter.Interface }) => React.ReactNode;
}

export function TrendsProvider({ children }: TrendsProviderProps): React.ReactNode {
    const { presenter } = useFeature(TrendsPageFeature);
    return children({ presenter });
}
