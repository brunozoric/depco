import { createAbstraction, Result } from "#shared/index.js";
import type { UserResponse } from "#shared/users/index.js";

export interface IGetUserUseCaseParams {
    id: string;
}

export type IGetUserUseCaseData = UserResponse;

export interface IUserNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IGetUserUseCaseErrors {
    notFound: IUserNotFoundError;
    unexpected: IUnexpectedError;
}

type GetUserUseCaseError = IGetUserUseCaseErrors[keyof IGetUserUseCaseErrors];

export interface IGetUserUseCase {
    execute(
        params: IGetUserUseCaseParams
    ): Promise<Result<IGetUserUseCaseData, GetUserUseCaseError>>;
}

export const GetUserUseCase = createAbstraction<IGetUserUseCase>("Api/GetUserUseCase");

export namespace GetUserUseCase {
    export type Interface = IGetUserUseCase;
    export type Params = IGetUserUseCaseParams;
    export type Data = IGetUserUseCaseData;
    export type Error = GetUserUseCaseError;
}
