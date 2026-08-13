import { createAbstraction, Result } from "#shared/index.js";
import type { ILicensePolicyFilters } from "../licensePolicyConditions.js";
import type { ILicensePolicyRuleRow } from "../licensePolicyRuleRow.js";

export interface IListLicensePoliciesUseCaseData {
    items: ILicensePolicyRuleRow[];
}

export interface IListLicensePoliciesUseCaseError {
    statusCode: number;
    message: string;
}

export interface IListLicensePoliciesUseCase {
    execute(
        params: ILicensePolicyFilters
    ): Promise<Result<IListLicensePoliciesUseCaseData, IListLicensePoliciesUseCaseError>>;
}

export const ListLicensePoliciesUseCase = createAbstraction<IListLicensePoliciesUseCase>(
    "Api/ListLicensePoliciesUseCase"
);

export namespace ListLicensePoliciesUseCase {
    export type Interface = IListLicensePoliciesUseCase;
    export type Params = ILicensePolicyFilters;
    export type Data = IListLicensePoliciesUseCaseData;
    export type Error = IListLicensePoliciesUseCaseError;
}
