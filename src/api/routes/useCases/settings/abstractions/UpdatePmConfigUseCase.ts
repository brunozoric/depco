import { createAbstraction, Result } from "#shared/index.js";
import type { PackageManagerId } from "#shared/security/index.js";
import type { IPmConfigItemResponse } from "../pmConfigHelper.js";

export type IUpdatePmConfigUseCaseUpgradeStrategy = "caret" | "tilde" | "exact" | "latest" | "";

export interface IUpdatePmConfigUseCaseParams {
    pm: PackageManagerId;
    installFlags?: Record<string, boolean> | undefined;
    registryUrl?: string | undefined;
    upgradeStrategy?: IUpdatePmConfigUseCaseUpgradeStrategy | undefined;
}

export type IUpdatePmConfigUseCaseData = IPmConfigItemResponse;

export interface IUpdatePmConfigUseCaseError {
    statusCode: number;
    message: string;
}

export interface IUpdatePmConfigUseCase {
    execute(
        params: IUpdatePmConfigUseCaseParams
    ): Promise<Result<IUpdatePmConfigUseCaseData, IUpdatePmConfigUseCaseError>>;
}

export const UpdatePmConfigUseCase = createAbstraction<IUpdatePmConfigUseCase>(
    "Api/UpdatePmConfigUseCase"
);

export namespace UpdatePmConfigUseCase {
    export type Interface = IUpdatePmConfigUseCase;
    export type Params = IUpdatePmConfigUseCaseParams;
    export type Data = IUpdatePmConfigUseCaseData;
    export type Error = IUpdatePmConfigUseCaseError;
    export type UpgradeStrategy = IUpdatePmConfigUseCaseUpgradeStrategy;
}
