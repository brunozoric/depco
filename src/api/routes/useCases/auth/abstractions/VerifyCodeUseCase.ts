import { createAbstraction, Result } from "#shared/index.js";
import type { AuthService } from "#api/services/Auth/index.js";

export interface IVerifyCodeUseCaseParams {
    email: string;
    code: string;
}

export interface IVerifyCodeUseCaseError {
    statusCode: number;
    message: string;
}

export interface IVerifyCodeUseCase {
    execute(
        params: IVerifyCodeUseCaseParams
    ): Promise<Result<AuthService.VerifyResult, IVerifyCodeUseCaseError>>;
}

export const VerifyCodeUseCase = createAbstraction<IVerifyCodeUseCase>("Api/VerifyCodeUseCase");

export namespace VerifyCodeUseCase {
    export type Interface = IVerifyCodeUseCase;
    export type Params = IVerifyCodeUseCaseParams;
    export type Error = IVerifyCodeUseCaseError;
    export type Data = AuthService.VerifyResult;
}
