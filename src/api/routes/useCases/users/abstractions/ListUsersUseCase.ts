import { createAbstraction, Result } from "#shared/index.js";
import type { UserService } from "#api/services/Auth/index.js";

export interface IListUsersUseCaseParams {
    search?: string | undefined;
    isActive?: boolean | undefined;
    page: number;
    pageSize: number;
    sortBy: "email" | "displayName" | "createdAt";
    sortOrder: "asc" | "desc";
}

export type IListUsersUseCaseData = UserService.ListResult;

export interface IUnexpectedError {
    code: "UNEXPECTED_ERROR";
    statusCode: number;
    message: string;
}

export interface IListUsersUseCaseErrors {
    unexpected: IUnexpectedError;
}

type ListUsersUseCaseError = IListUsersUseCaseErrors[keyof IListUsersUseCaseErrors];

export interface IListUsersUseCase {
    execute(
        params: IListUsersUseCaseParams
    ): Promise<Result<IListUsersUseCaseData, ListUsersUseCaseError>>;
}

export const ListUsersUseCase = createAbstraction<IListUsersUseCase>("Api/ListUsersUseCase");

export namespace ListUsersUseCase {
    export type Interface = IListUsersUseCase;
    export type Params = IListUsersUseCaseParams;
    export type Data = IListUsersUseCaseData;
    export type Error = ListUsersUseCaseError;
}
