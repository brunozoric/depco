import { createAbstraction } from "#shared/index.js";

export interface ISbomLastExport {
    format: string;
    timestamp: number;
    filename: string;
}

export interface ISbomRepository {
    getLastExport(): ISbomLastExport | null;
    setLastExport(lastExport: ISbomLastExport): void;
}

export const SbomRepository = createAbstraction<ISbomRepository>("Ui/SbomRepository");

export namespace SbomRepository {
    export type Interface = ISbomRepository;
    export type LastExport = ISbomLastExport;
}
