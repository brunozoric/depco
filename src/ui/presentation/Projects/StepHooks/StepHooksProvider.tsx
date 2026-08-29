import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { StepHooksPresentationFeature } from "./feature.js";
import type { StepHooksPresenter } from "./abstractions/StepHooksPresenter.js";

interface IStepHooksPresenterParams {
    presenter: StepHooksPresenter.Interface;
}

interface IStepHooksProviderProps {
    children: (params: IStepHooksPresenterParams) => React.ReactNode;
}

export function StepHooksProvider({ children }: IStepHooksProviderProps): React.ReactNode {
    const { presenter } = useFeature(StepHooksPresentationFeature);
    return children({ presenter });
}
