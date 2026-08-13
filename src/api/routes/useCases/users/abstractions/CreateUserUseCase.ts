import { createAbstraction, Result } from "#shared/index.js";
import type { UserPermission, UserResponse } from "#shared/users/index.js";

export interface ICreateUserUseCaseParams {
    email: string;
    displayName: string;
    password: string;
    permission: UserPermission;
}

export type ICreateUserUseCaseData = UserResponse;

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface ICreateUserUseCaseErrors {
    unexpected: IUnexpectedError;
}

type CreateUserUseCaseError = ICreateUserUseCaseErrors[keyof ICreateUserUseCaseErrors];

export interface ICreateUserUseCase {
    execute(
        params: ICreateUserUseCaseParams
    ): Promise<Result<ICreateUserUseCaseData, CreateUserUseCaseError>>;
}

export const CreateUserUseCase = createAbstraction<ICreateUserUseCase>("Api/CreateUserUseCase");

export namespace CreateUserUseCase {
    export type Interface = ICreateUserUseCase;
    export type Params = ICreateUserUseCaseParams;
    export type Data = ICreateUserUseCaseData;
    export type Error = CreateUserUseCaseError;
}
