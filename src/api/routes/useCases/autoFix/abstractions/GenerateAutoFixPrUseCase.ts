import {
    createAbstraction,
    Result,
    type IUnexpectedError,
    type IProjectNotFoundError
} from "#shared/index.js";

export interface IGenerateAutoFixPrUseCaseParams {
    projectId: string;
}

export interface IGenerateAutoFixPrUseCaseData {
    jobId: string;
}

export interface IGenerateAutoFixPrUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type GenerateAutoFixPrUseCaseError =
    IGenerateAutoFixPrUseCaseErrors[keyof IGenerateAutoFixPrUseCaseErrors];

export interface IGenerateAutoFixPrUseCase {
    execute(
        params: IGenerateAutoFixPrUseCaseParams
    ): Promise<Result<IGenerateAutoFixPrUseCaseData, GenerateAutoFixPrUseCaseError>>;
}

export const GenerateAutoFixPrUseCase = createAbstraction<IGenerateAutoFixPrUseCase>(
    "Api/GenerateAutoFixPrUseCase"
);

export namespace GenerateAutoFixPrUseCase {
    export type Interface = IGenerateAutoFixPrUseCase;
    export type Params = IGenerateAutoFixPrUseCaseParams;
    export type Data = IGenerateAutoFixPrUseCaseData;
    export type Error = GenerateAutoFixPrUseCaseError;
}
