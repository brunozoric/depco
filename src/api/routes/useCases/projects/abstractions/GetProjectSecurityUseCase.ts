import { createAbstraction, Result } from "#shared/index.js";
import type { SecurityService } from "#api/services/Security/index.js";

export interface IGetProjectSecurityUseCaseParams {
    id: string;
}

export interface IProjectNotFoundError {
    code: "PROJECT_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetProjectSecurityUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type GetProjectSecurityUseCaseError =
    IGetProjectSecurityUseCaseErrors[keyof IGetProjectSecurityUseCaseErrors];

export interface IGetProjectSecurityUseCase {
    execute(
        params: IGetProjectSecurityUseCaseParams
    ): Promise<Result<SecurityService.CheckResult | null, GetProjectSecurityUseCaseError>>;
}

export const GetProjectSecurityUseCase = createAbstraction<IGetProjectSecurityUseCase>(
    "Api/GetProjectSecurityUseCase"
);

export namespace GetProjectSecurityUseCase {
    export type Interface = IGetProjectSecurityUseCase;
    export type Params = IGetProjectSecurityUseCaseParams;
    export type Data = SecurityService.CheckResult | null;
    export type Error = GetProjectSecurityUseCaseError;
}
