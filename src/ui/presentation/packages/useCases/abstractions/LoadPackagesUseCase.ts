import { createAbstraction } from "#shared/index.js";
import type { PackagesGateway } from "../../../../features/packages/abstractions/PackagesGateway.js";

export interface ILoadPackagesUseCase {
    execute(filters?: PackagesGateway.Filters): Promise<void>;
}

export const LoadPackagesUseCase =
    createAbstraction<ILoadPackagesUseCase>("Ui/LoadPackagesUseCase");

export namespace LoadPackagesUseCase {
    export type Interface = ILoadPackagesUseCase;
}
