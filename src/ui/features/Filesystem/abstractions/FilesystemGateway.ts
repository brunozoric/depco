import { createAbstraction } from "#shared/index.js";

export interface IBrowseItem {
    name: string;
    path: string;
}

export interface IBrowseResult {
    items: IBrowseItem[];
    currentPath: string;
}

export interface IScanResult {
    items: IBrowseItem[];
    scannedPath: string;
    scannedCount: number;
    filteredCount: number;
    total: number;
    mode: "workspaces" | "depth";
}

export interface IFilesystemGateway {
    browse(path?: string, showHidden?: boolean): Promise<IBrowseResult>;
    scan(path: string, depth?: number): Promise<IScanResult>;
}

export const FilesystemGateway = createAbstraction<IFilesystemGateway>("Ui/FilesystemGateway");

export namespace FilesystemGateway {
    export type Interface = IFilesystemGateway;
    export type BrowseItem = IBrowseItem;
    export type BrowseResult = IBrowseResult;
    export type ScanResult = IScanResult;
}
