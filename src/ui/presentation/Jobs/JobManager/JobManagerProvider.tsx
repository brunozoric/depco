import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { JobManagerPresentationFeature } from "./feature.js";
import type { JobManagerPresenter } from "./abstractions/JobManagerPresenter.js";

interface JobManagerProviderProps {
    children: (params: { presenter: JobManagerPresenter.Interface }) => React.ReactNode;
}

export function JobManagerProvider({ children }: JobManagerProviderProps): React.ReactNode {
    const { presenter } = useFeature(JobManagerPresentationFeature);
    return children({ presenter });
}
