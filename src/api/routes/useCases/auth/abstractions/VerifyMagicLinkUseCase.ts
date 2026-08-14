import { createAbstraction, Result } from "#shared/index.js";
import type { AuthService } from "#api/services/Auth/index.js";

export interface IVerifyMagicLinkUseCaseParams {
    token: string;
    email: string;
}

export interface IVerifyMagicLinkUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IVerifyMagicLinkUseCase {
    execute(
        params: IVerifyMagicLinkUseCaseParams
    ): Promise<Result<AuthService.VerifyResult, IVerifyMagicLinkUseCaseError>>;
}

export const VerifyMagicLinkUseCase = createAbstraction<IVerifyMagicLinkUseCase>(
    "Api/VerifyMagicLinkUseCase"
);

export namespace VerifyMagicLinkUseCase {
    export type Interface = IVerifyMagicLinkUseCase;
    export type Params = IVerifyMagicLinkUseCaseParams;
    export type Error = IVerifyMagicLinkUseCaseError;
    export type Data = AuthService.VerifyResult;
}
