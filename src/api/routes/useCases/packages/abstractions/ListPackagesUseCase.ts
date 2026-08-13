import { createAbstraction, Result } from "#shared/index.js";
import type { PackageQueryService } from "#api/services/Package/index.js";

export type IListPackagesUseCaseParams = PackageQueryService.ListFilters;

export type IListPackagesUseCaseData = PackageQueryService.ListResult;

export interface IUnexpectedError {
    statusCode: number;
    message: string;
}

export interface IListPackagesUseCaseErrors {
    unexpected: IUnexpectedError;
}

type ListPackagesUseCaseError = IListPackagesUseCaseErrors[keyof IListPackagesUseCaseErrors];

export interface IListPackagesUseCase {
    execute(
        params: IListPackagesUseCaseParams
    ): Promise<Result<IListPackagesUseCaseData, ListPackagesUseCaseError>>;
}

export const ListPackagesUseCase =
    createAbstraction<IListPackagesUseCase>("Api/ListPackagesUseCase");

export namespace ListPackagesUseCase {
    export type Interface = IListPackagesUseCase;
    export type Params = IListPackagesUseCaseParams;
    export type Data = IListPackagesUseCaseData;
    export type Error = ListPackagesUseCaseError;
}
