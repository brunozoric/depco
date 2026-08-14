import { createAbstraction, Result } from "#shared/index.js";
import type { LicensePolicyAction } from "#shared/licenses/types.js";
import type { ILicensePolicyRuleRow } from "../licensePolicyRuleRow.js";

export interface ICreateLicensePolicyUseCaseParams {
    action: LicensePolicyAction;
    licensePattern?: string | null | undefined;
    packagePattern?: string | null | undefined;
    projectId?: string | null | undefined;
    priority: number;
    reason?: string | null | undefined;
}

export interface ICreateLicensePolicyUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface ICreateLicensePolicyUseCase {
    execute(
        params: ICreateLicensePolicyUseCaseParams
    ): Promise<Result<ILicensePolicyRuleRow, ICreateLicensePolicyUseCaseError>>;
}

export const CreateLicensePolicyUseCase = createAbstraction<ICreateLicensePolicyUseCase>(
    "Api/CreateLicensePolicyUseCase"
);

export namespace CreateLicensePolicyUseCase {
    export type Interface = ICreateLicensePolicyUseCase;
    export type Params = ICreateLicensePolicyUseCaseParams;
    export type Data = ILicensePolicyRuleRow;
    export type Error = ICreateLicensePolicyUseCaseError;
}
