import type React from "react";
import { useFeature } from "#ui/shared/di/useFeature.js";
import { LicenseListFeature } from "./feature.js";
import type { LicensesPresenter } from "./abstractions/LicensesPresenter.js";

interface LicensesProviderProps {
    children: (params: { presenter: LicensesPresenter.Interface }) => React.ReactNode;
}

export function LicensesProvider({ children }: LicensesProviderProps): React.ReactNode {
    const { presenter } = useFeature(LicenseListFeature);
    return children({ presenter });
}
