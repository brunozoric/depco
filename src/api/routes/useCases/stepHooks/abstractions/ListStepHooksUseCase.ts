import { createAbstraction, Result } from "#shared/index.js";
import type { PackageJsonService } from "#api/services/PackageJson/index.js";
import type { IStepHookResponse } from "../stepHookHelper.js";

export interface IListStepHooksUseCaseParams {
    projectId: string;
}

export interface IListStepHooksUseCaseData {
    items: IStepHookResponse[];
    configSource: "db" | "file";
    discoveredScripts: PackageJsonService.DiscoveredScript[];
}

export interface IProjectNotFoundError {
    code: "PROJECT_NOT_FOUND";
    statusCode: 404;
    message: string;
}

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListStepHooksUseCaseErrors {
    projectNotFound: IProjectNotFoundError;
    unexpected: IUnexpectedError;
}

type ListStepHooksUseCaseError = IListStepHooksUseCaseErrors[keyof IListStepHooksUseCaseErrors];

export interface IListStepHooksUseCase {
    execute(
        params: IListStepHooksUseCaseParams
    ): Promise<Result<IListStepHooksUseCaseData, ListStepHooksUseCaseError>>;
}

export const ListStepHooksUseCase = createAbstraction<IListStepHooksUseCase>(
    "Api/ListStepHooksUseCase"
);

export namespace ListStepHooksUseCase {
    export type Interface = IListStepHooksUseCase;
    export type Params = IListStepHooksUseCaseParams;
    export type Data = IListStepHooksUseCaseData;
    export type Error = ListStepHooksUseCaseError;
}
