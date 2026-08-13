import { createAbstraction, Result } from "#shared/index.js";

export interface ILogoutUseCaseParams {
    authorizationHeader: string | undefined;
}

export interface ILogoutUseCase {
    execute(params: ILogoutUseCaseParams): Promise<Result<void, never>>;
}

export const LogoutUseCase = createAbstraction<ILogoutUseCase>("Api/LogoutUseCase");

export namespace LogoutUseCase {
    export type Interface = ILogoutUseCase;
    export type Params = ILogoutUseCaseParams;
}
