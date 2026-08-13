import { createAbstraction, Result } from "#shared/index.js";

export interface ICreateProjectUseCaseParams {
    projectPath: string;
}

export interface ICreateProjectUseCaseData {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
    lastScannedAt: null;
    hasNodeModules: boolean;
}

export interface IRegistrationFailedError {
    statusCode: 400;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface ICreateProjectUseCaseErrors {
    registrationFailed: IRegistrationFailedError;
    unexpected: IUnexpectedError;
}

type CreateProjectUseCaseError = ICreateProjectUseCaseErrors[keyof ICreateProjectUseCaseErrors];

export interface ICreateProjectUseCase {
    execute(
        params: ICreateProjectUseCaseParams
    ): Promise<Result<ICreateProjectUseCaseData, CreateProjectUseCaseError>>;
}

export const CreateProjectUseCase = createAbstraction<ICreateProjectUseCase>(
    "Api/CreateProjectUseCase"
);

export namespace CreateProjectUseCase {
    export type Interface = ICreateProjectUseCase;
    export type Params = ICreateProjectUseCaseParams;
    export type Data = ICreateProjectUseCaseData;
    export type Error = CreateProjectUseCaseError;
}
