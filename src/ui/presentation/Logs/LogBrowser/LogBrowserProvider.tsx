import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { LogBrowserPresentationFeature } from "./feature.js";
import type { LogBrowserPresenter } from "./abstractions/LogBrowserPresenter.js";

interface ILogBrowserPresenterParams {
    presenter: LogBrowserPresenter.Interface;
}

interface ILogBrowserProviderProps {
    children: (params: ILogBrowserPresenterParams) => React.ReactNode;
}

export function LogBrowserProvider({ children }: ILogBrowserProviderProps): React.ReactNode {
    const { presenter } = useFeature(LogBrowserPresentationFeature);
    return children({ presenter });
}
