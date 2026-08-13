import { createAbstraction, Result } from "#shared/index.js";
import type { IStepHookResponse } from "../stepHookHelper.js";

export interface IUpdateStepHookUseCaseParams {
    projectId: string;
    hookId: string;
    name?: string | undefined;
    command?: string | undefined;
    type?: "command" | "script" | "package-script" | undefined;
    required?: boolean | undefined;
    enabled?: boolean | undefined;
    sortOrder?: number | undefined;
}

export type IUpdateStepHookUseCaseData = IStepHookResponse;

export interface IStepHookNotFoundError {
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IUpdateStepHookUseCaseErrors {
    notFound: IStepHookNotFoundError;
    unexpected: IUnexpectedError;
}

type UpdateStepHookUseCaseError = IUpdateStepHookUseCaseErrors[keyof IUpdateStepHookUseCaseErrors];

export interface IUpdateStepHookUseCase {
    execute(
        params: IUpdateStepHookUseCaseParams
    ): Promise<Result<IUpdateStepHookUseCaseData, UpdateStepHookUseCaseError>>;
}

export const UpdateStepHookUseCase = createAbstraction<IUpdateStepHookUseCase>(
    "Api/UpdateStepHookUseCase"
);

export namespace UpdateStepHookUseCase {
    export type Interface = IUpdateStepHookUseCase;
    export type Params = IUpdateStepHookUseCaseParams;
    export type Data = IUpdateStepHookUseCaseData;
    export type Error = UpdateStepHookUseCaseError;
}
