import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { StepHooksPresentationFeature } from "./feature.js";
import type { StepHooksPresenter } from "./abstractions/StepHooksPresenter.js";

interface StepHooksProviderProps {
    children: (params: { presenter: StepHooksPresenter.Interface }) => React.ReactNode;
}

export function StepHooksProvider({ children }: StepHooksProviderProps): React.ReactNode {
    const { presenter } = useFeature(StepHooksPresentationFeature);
    return children({ presenter });
}
