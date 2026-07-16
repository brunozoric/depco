import { createAbstraction } from "#shared/index.js";
import type { LicensesGateway } from "../../../../features/licenses/abstractions/LicensesGateway.js";

export interface ILoadLicensesUseCase {
    execute(filters?: LicensesGateway.ListFilters): Promise<void>;
}

export const LoadLicensesUseCase =
    createAbstraction<ILoadLicensesUseCase>("Ui/LoadLicensesUseCase");

export namespace LoadLicensesUseCase {
    export type Interface = ILoadLicensesUseCase;
}
