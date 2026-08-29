import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { JobManagerPresentationFeature } from "./feature.js";
import type { JobManagerPresenter } from "./abstractions/JobManagerPresenter.js";

interface IJobManagerPresenterParams {
    presenter: JobManagerPresenter.Interface;
}

interface IJobManagerProviderProps {
    children: (params: IJobManagerPresenterParams) => React.ReactNode;
}

export function JobManagerProvider({ children }: IJobManagerProviderProps): React.ReactNode {
    const { presenter } = useFeature(JobManagerPresentationFeature);
    return children({ presenter });
}
