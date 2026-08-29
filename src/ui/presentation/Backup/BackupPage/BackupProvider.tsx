import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { BackupPresentationFeature } from "./feature.js";
import type { BackupPresenter } from "./abstractions/BackupPresenter.js";

interface IBackupPresenterParams {
    presenter: BackupPresenter.Interface;
}

interface IBackupProviderProps {
    children: (params: IBackupPresenterParams) => React.ReactNode;
}

export function BackupProvider({ children }: IBackupProviderProps): React.ReactNode {
    const { presenter } = useFeature(BackupPresentationFeature);
    return children({ presenter });
}
