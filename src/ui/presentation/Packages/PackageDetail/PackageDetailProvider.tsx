import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { PackageDetailFeature } from "./feature.js";
import type { PackageDetailPresenter } from "./abstractions/PackageDetailPresenter.js";

interface PackageDetailProviderProps {
    children: (params: { presenter: PackageDetailPresenter.Interface }) => React.ReactNode;
}

export function PackageDetailProvider({ children }: PackageDetailProviderProps): React.ReactNode {
    const { presenter } = useFeature(PackageDetailFeature);
    return children({ presenter });
}
