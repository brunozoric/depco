import type React from "react";
import { useFeature } from "#ui/infrastructure/Shared/di/useFeature.js";
import { PackageDetailFeature } from "./feature.js";
import type { PackageDetailPresenter } from "./abstractions/PackageDetailPresenter.js";

interface IPackageDetailPresenterParams {
    presenter: PackageDetailPresenter.Interface;
}

interface IPackageDetailProviderProps {
    children: (params: IPackageDetailPresenterParams) => React.ReactNode;
}

export function PackageDetailProvider({ children }: IPackageDetailProviderProps): React.ReactNode {
    const { presenter } = useFeature(PackageDetailFeature);
    return children({ presenter });
}
