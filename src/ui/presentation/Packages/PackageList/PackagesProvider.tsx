import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { PackageListFeature } from "./feature.js";
import type { PackagesPresenter } from "./abstractions/PackagesPresenter.js";

interface PackagesProviderProps {
    children: (params: { presenter: PackagesPresenter.Interface }) => React.ReactNode;
}

export function PackagesProvider({ children }: PackagesProviderProps): React.ReactNode {
    const { presenter } = useFeature(PackageListFeature);
    return children({ presenter });
}
