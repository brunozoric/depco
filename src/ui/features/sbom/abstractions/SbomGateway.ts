import { createAbstraction } from "#shared/index.js";

export interface ISbomExportResponse {
    blob: Blob;
    filename: string;
}

export interface ISbomGateway {
    exportProject(projectId: string, format: string): Promise<ISbomExportResponse>;
    exportAll(format: string): Promise<ISbomExportResponse>;
}

export const SbomGateway = createAbstraction<ISbomGateway>("Ui/SbomGateway");

export namespace SbomGateway {
    export type Interface = ISbomGateway;
    export type ExportResponse = ISbomExportResponse;
}
