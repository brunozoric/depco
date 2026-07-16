import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { LogBrowserPresentationFeature } from "./feature.js";
import type { LogBrowserPresenter } from "./abstractions/LogBrowserPresenter.js";

interface LogBrowserProviderProps {
    children: (params: { presenter: LogBrowserPresenter.Interface }) => React.ReactNode;
}

export function LogBrowserProvider({ children }: LogBrowserProviderProps): React.ReactNode {
    const { presenter } = useFeature(LogBrowserPresentationFeature);
    return children({ presenter });
}
