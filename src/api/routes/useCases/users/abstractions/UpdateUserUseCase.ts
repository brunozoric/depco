import { createAbstraction, Result } from "#shared/index.js";
import type { UserPermission, UserResponse } from "#shared/users/index.js";

export interface IUpdateUserUseCaseParams {
    id: string;
    sessionUserId: string;
    sessionUserPermission: string;
    displayName?: string | undefined;
    password?: string | undefined;
    permission?: UserPermission | undefined;
    isActive?: boolean | undefined;
}

export type IUpdateUserUseCaseData = UserResponse;

export interface IUserNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IInsufficientPermissionError {
    statusCode: 403;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IUpdateUserUseCaseErrors {
    notFound: IUserNotFoundError;
    insufficientPermission: IInsufficientPermissionError;
    unexpected: IUnexpectedError;
}

type UpdateUserUseCaseError = IUpdateUserUseCaseErrors[keyof IUpdateUserUseCaseErrors];

export interface IUpdateUserUseCase {
    execute(
        params: IUpdateUserUseCaseParams
    ): Promise<Result<IUpdateUserUseCaseData, UpdateUserUseCaseError>>;
}

export const UpdateUserUseCase = createAbstraction<IUpdateUserUseCase>("Api/UpdateUserUseCase");

export namespace UpdateUserUseCase {
    export type Interface = IUpdateUserUseCase;
    export type Params = IUpdateUserUseCaseParams;
    export type Data = IUpdateUserUseCaseData;
    export type Error = UpdateUserUseCaseError;
}
