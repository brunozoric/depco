import { createAbstraction, Result } from "#shared/index.js";

export interface IRequestMagicLinkUseCaseParams {
    email: string;
    baseUrl: string;
}

export interface IRequestMagicLinkUseCase {
    execute(params: IRequestMagicLinkUseCaseParams): Promise<Result<void, never>>;
}

export const RequestMagicLinkUseCase = createAbstraction<IRequestMagicLinkUseCase>(
    "Api/RequestMagicLinkUseCase"
);

export namespace RequestMagicLinkUseCase {
    export type Interface = IRequestMagicLinkUseCase;
    export type Params = IRequestMagicLinkUseCaseParams;
}
