import { createAbstraction, Result } from "#shared/index.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";
import type { ILicensePolicyRuleRow } from "../licensePolicyRuleRow.js";

export interface IUpdateLicensePolicyUseCaseParams {
    id: string;
    action?: LicensePolicyAction | undefined;
    licensePattern?: string | null | undefined;
    packagePattern?: string | null | undefined;
    projectId?: string | null | undefined;
    priority?: number | undefined;
    reason?: string | null | undefined;
}

export interface IPolicyNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IUpdateLicensePolicyUseCaseErrors {
    notFound: IPolicyNotFoundError;
    unexpected: IUnexpectedError;
}

type UpdateLicensePolicyUseCaseError =
    IUpdateLicensePolicyUseCaseErrors[keyof IUpdateLicensePolicyUseCaseErrors];

export interface IUpdateLicensePolicyUseCase {
    execute(
        params: IUpdateLicensePolicyUseCaseParams
    ): Promise<Result<ILicensePolicyRuleRow, UpdateLicensePolicyUseCaseError>>;
}

export const UpdateLicensePolicyUseCase = createAbstraction<IUpdateLicensePolicyUseCase>(
    "Api/UpdateLicensePolicyUseCase"
);

export namespace UpdateLicensePolicyUseCase {
    export type Interface = IUpdateLicensePolicyUseCase;
    export type Params = IUpdateLicensePolicyUseCaseParams;
    export type Data = ILicensePolicyRuleRow;
    export type Error = UpdateLicensePolicyUseCaseError;
}
