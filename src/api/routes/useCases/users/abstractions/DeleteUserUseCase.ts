import { createAbstraction, Result } from "#shared/index.js";

export interface IDeleteUserUseCaseParams {
    id: string;
    sessionUserId: string;
}

export interface ICannotDeleteSelfError {
    code: "CANNOT_DELETE_SELF";
    statusCode: 400;
    message: string;
}

export interface IUserNotFoundError {
    code: "USER_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IDeleteUserUseCaseErrors {
    cannotDeleteSelf: ICannotDeleteSelfError;
    notFound: IUserNotFoundError;
    unexpected: IUnexpectedError;
}

type DeleteUserUseCaseError = IDeleteUserUseCaseErrors[keyof IDeleteUserUseCaseErrors];

export interface IDeleteUserUseCase {
    execute(params: IDeleteUserUseCaseParams): Promise<Result<void, DeleteUserUseCaseError>>;
}

export const DeleteUserUseCase = createAbstraction<IDeleteUserUseCase>("Api/DeleteUserUseCase");

export namespace DeleteUserUseCase {
    export type Interface = IDeleteUserUseCase;
    export type Params = IDeleteUserUseCaseParams;
    export type Error = DeleteUserUseCaseError;
}
