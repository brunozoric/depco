import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { LicenseListFeature } from "./feature.js";
import type { LicensesPresenter } from "./abstractions/LicensesPresenter.js";

interface ILicensesPresenterParams {
    presenter: LicensesPresenter.Interface;
}

interface ILicensesProviderProps {
    children: (params: ILicensesPresenterParams) => React.ReactNode;
}

export function LicensesProvider({ children }: ILicensesProviderProps): React.ReactNode {
    const { presenter } = useFeature(LicenseListFeature);
    return children({ presenter });
}
