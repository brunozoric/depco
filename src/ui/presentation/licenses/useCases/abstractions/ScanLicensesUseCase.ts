import { createAbstraction } from "#shared/index.js";
import type { LicensesGateway } from "../../../../features/Licenses/abstractions/LicensesGateway.js";

export interface IScanLicensesUseCase {
    execute(projectId: string): Promise<LicensesGateway.ScanResult>;
}

export const ScanLicensesUseCase =
    createAbstraction<IScanLicensesUseCase>("Ui/ScanLicensesUseCase");

export namespace ScanLicensesUseCase {
    export type Interface = IScanLicensesUseCase;
}
