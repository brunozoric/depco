import { createAbstraction, Result } from "#shared/index.js";

export interface IForceLogoutUserUseCaseParams {
    id: string;
    sessionUserId: string;
}

export interface ICannotForceLogoutSelfError {
    code: "CANNOT_FORCE_LOGOUT_SELF";
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

export interface IForceLogoutUserUseCaseErrors {
    cannotForceLogoutSelf: ICannotForceLogoutSelfError;
    notFound: IUserNotFoundError;
    unexpected: IUnexpectedError;
}

type ForceLogoutUserUseCaseError =
    IForceLogoutUserUseCaseErrors[keyof IForceLogoutUserUseCaseErrors];

export interface IForceLogoutUserUseCase {
    execute(
        params: IForceLogoutUserUseCaseParams
    ): Promise<Result<void, ForceLogoutUserUseCaseError>>;
}

export const ForceLogoutUserUseCase = createAbstraction<IForceLogoutUserUseCase>(
    "Api/ForceLogoutUserUseCase"
);

export namespace ForceLogoutUserUseCase {
    export type Interface = IForceLogoutUserUseCase;
    export type Params = IForceLogoutUserUseCaseParams;
    export type Error = ForceLogoutUserUseCaseError;
}
