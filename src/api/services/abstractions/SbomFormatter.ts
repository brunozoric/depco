import { createAbstraction } from "#shared/index.js";
import type { SbomService } from "./SbomService.js";

export interface ISbomFormatterResult {
    content: Record<string, unknown>;
    filename: string;
    mediaType: string;
}

export interface ISbomFormatter {
    readonly name: string;
    format(data: SbomService.ProjectData): ISbomFormatterResult;
}

export const SbomFormatter = createAbstraction<ISbomFormatter>("Api/SbomFormatter");

export namespace SbomFormatter {
    export type Interface = ISbomFormatter;
    export type ProjectData = SbomService.ProjectData;
    export type Result = ISbomFormatterResult;
}

export function sanitizeFilename(name: string): string {
    return name.replace(/["\r\n/\\:]/g, "-");
}
