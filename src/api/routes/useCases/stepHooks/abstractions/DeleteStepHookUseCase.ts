import { createAbstraction, Result } from "#shared/index.js";

export interface IDeleteStepHookUseCaseParams {
    projectId: string;
    hookId: string;
}

export interface IDeleteStepHookUseCaseData {
    deleted: boolean;
}

export interface IStepHookNotFoundError {
    code: "STEP_HOOK_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IDeleteStepHookUseCaseErrors {
    notFound: IStepHookNotFoundError;
    unexpected: IUnexpectedError;
}

type DeleteStepHookUseCaseError = IDeleteStepHookUseCaseErrors[keyof IDeleteStepHookUseCaseErrors];

export interface IDeleteStepHookUseCase {
    execute(
        params: IDeleteStepHookUseCaseParams
    ): Promise<Result<IDeleteStepHookUseCaseData, DeleteStepHookUseCaseError>>;
}

export const DeleteStepHookUseCase = createAbstraction<IDeleteStepHookUseCase>(
    "Api/DeleteStepHookUseCase"
);

export namespace DeleteStepHookUseCase {
    export type Interface = IDeleteStepHookUseCase;
    export type Params = IDeleteStepHookUseCaseParams;
    export type Data = IDeleteStepHookUseCaseData;
    export type Error = DeleteStepHookUseCaseError;
}
