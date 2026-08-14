import { createAbstraction, Result } from "#shared/index.js";

export interface ILoginUseCaseParams {
    email: string;
    password: string;
}

export interface ILoginUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface ILoginUseCase {
    execute(params: ILoginUseCaseParams): Promise<Result<void, ILoginUseCaseError>>;
}

export const LoginUseCase = createAbstraction<ILoginUseCase>("Api/LoginUseCase");

export namespace LoginUseCase {
    export type Interface = ILoginUseCase;
    export type Params = ILoginUseCaseParams;
    export type Error = ILoginUseCaseError;
}
