import { createAbstraction, Result } from "#shared/index.js";

export interface IGetTransitiveResolveStatusUseCaseParams {
    id: string;
}

export interface IGetTransitiveResolveStatusUseCaseData {
    total: number;
    resolved: number;
    pending: number;
}

export interface IProjectNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IGetTransitiveResolveStatusUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type GetTransitiveResolveStatusUseCaseError =
    IGetTransitiveResolveStatusUseCaseErrors[keyof IGetTransitiveResolveStatusUseCaseErrors];

export interface IGetTransitiveResolveStatusUseCase {
    execute(
        params: IGetTransitiveResolveStatusUseCaseParams
    ): Promise<
        Result<IGetTransitiveResolveStatusUseCaseData, GetTransitiveResolveStatusUseCaseError>
    >;
}

export const GetTransitiveResolveStatusUseCase =
    createAbstraction<IGetTransitiveResolveStatusUseCase>("Api/GetTransitiveResolveStatusUseCase");

export namespace GetTransitiveResolveStatusUseCase {
    export type Interface = IGetTransitiveResolveStatusUseCase;
    export type Params = IGetTransitiveResolveStatusUseCaseParams;
    export type Data = IGetTransitiveResolveStatusUseCaseData;
    export type Error = GetTransitiveResolveStatusUseCaseError;
}
