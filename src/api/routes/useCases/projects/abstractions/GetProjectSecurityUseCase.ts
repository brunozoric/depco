import { createAbstraction, Result } from "#shared/index.js";
import type { SecurityService } from "#api/services/Security/index.js";

export interface IGetProjectSecurityUseCaseParams {
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
