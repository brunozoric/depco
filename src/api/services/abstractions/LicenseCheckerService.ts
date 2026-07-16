import { createAbstraction } from "#shared/index.js";

export interface ILicenseRecord {
    packageName: string;
    licenseName: string;
    spdxId: string | null;
    licenseUrl: string | null;
}

export interface ILicenseScanParams {
    projectId: string;
    packageManager: string;
}

export interface ILicenseCheckerService {
    scan(params: ILicenseScanParams): Promise<ILicenseRecord[]>;
}

export const LicenseCheckerService = createAbstraction<ILicenseCheckerService>(
    "Api/LicenseCheckerService"
);

export namespace LicenseCheckerService {
    export type Interface = ILicenseCheckerService;
    export type LicenseRecord = ILicenseRecord;
    export type ScanParams = ILicenseScanParams;
}
