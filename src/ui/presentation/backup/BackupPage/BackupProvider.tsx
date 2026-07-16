import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { BackupPresentationFeature } from "./feature.js";
import type { BackupPresenter } from "./abstractions/BackupPresenter.js";

interface BackupProviderProps {
    children: (params: { presenter: BackupPresenter.Interface }) => React.ReactNode;
}

export function BackupProvider({ children }: BackupProviderProps): React.ReactNode {
    const { presenter } = useFeature(BackupPresentationFeature);
    return children({ presenter });
}
