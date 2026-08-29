import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { PackageListFeature } from "./feature.js";
import type { PackagesPresenter } from "./abstractions/PackagesPresenter.js";

interface IPackagesPresenterParams {
    presenter: PackagesPresenter.Interface;
}

interface IPackagesProviderProps {
    children: (params: IPackagesPresenterParams) => React.ReactNode;
}

export function PackagesProvider({ children }: IPackagesProviderProps): React.ReactNode {
    const { presenter } = useFeature(PackageListFeature);
    return children({ presenter });
}
