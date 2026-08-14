import { createAbstraction, Result } from "#shared/index.js";
import type { UserResponse } from "#shared/users/index.js";

export interface IGetMeUseCaseParams {
    userId: string;
}

export interface IGetMeUseCaseError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IGetMeUseCase {
    execute(params: IGetMeUseCaseParams): Promise<Result<UserResponse, IGetMeUseCaseError>>;
}

export const GetMeUseCase = createAbstraction<IGetMeUseCase>("Api/GetMeUseCase");

export namespace GetMeUseCase {
    export type Interface = IGetMeUseCase;
    export type Params = IGetMeUseCaseParams;
    export type Error = IGetMeUseCaseError;
    export type Data = UserResponse;
}
