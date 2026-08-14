import { createAbstraction, Result, type IUnexpectedError } from "#shared/index.js";
import type { IStepHookResponse } from "../stepHookHelper.js";

export interface ICreateStepHookUseCaseParams {
    projectId: string;
    position: string;
    name: string;
    command: string;
    type: "command" | "script" | "package-script";
    required: boolean;
}

export type ICreateStepHookUseCaseData = IStepHookResponse;

export interface ICreateStepHookUseCaseErrors {
    unexpected: IUnexpectedError;
}

type CreateStepHookUseCaseError = ICreateStepHookUseCaseErrors[keyof ICreateStepHookUseCaseErrors];

export interface ICreateStepHookUseCase {
    execute(
        params: ICreateStepHookUseCaseParams
    ): Promise<Result<ICreateStepHookUseCaseData, CreateStepHookUseCaseError>>;
}

export const CreateStepHookUseCase = createAbstraction<ICreateStepHookUseCase>(
    "Api/CreateStepHookUseCase"
);

export namespace CreateStepHookUseCase {
    export type Interface = ICreateStepHookUseCase;
    export type Params = ICreateStepHookUseCaseParams;
    export type Data = ICreateStepHookUseCaseData;
    export type Error = CreateStepHookUseCaseError;
}
