import { createAbstraction, Result } from "#shared/index.js";
import type { SecurityService } from "#api/services/Security/index.js";

export interface ICheckProjectSecurityUseCaseParams {
    id: string;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface ICheckProjectSecurityUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type CheckProjectSecurityUseCaseError =
    ICheckProjectSecurityUseCaseErrors[keyof ICheckProjectSecurityUseCaseErrors];

export interface ICheckProjectSecurityUseCase {
    execute(
        params: ICheckProjectSecurityUseCaseParams
    ): Promise<Result<SecurityService.CheckResult, CheckProjectSecurityUseCaseError>>;
}

export const CheckProjectSecurityUseCase = createAbstraction<ICheckProjectSecurityUseCase>(
    "Api/CheckProjectSecurityUseCase"
);

export namespace CheckProjectSecurityUseCase {
    export type Interface = ICheckProjectSecurityUseCase;
    export type Params = ICheckProjectSecurityUseCaseParams;
    export type Data = SecurityService.CheckResult;
    export type Error = CheckProjectSecurityUseCaseError;
}
