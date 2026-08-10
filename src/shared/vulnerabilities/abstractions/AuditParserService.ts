import { createAbstraction } from "#shared/index.js";
import type { IAuditRecord } from "../types.js";

export interface IAuditParserInput {
    jsonOutput: string;
    packageManager: string;
}

export interface IAuditParserService {
    parse(input: IAuditParserInput): IAuditRecord[];
}

export const AuditParserService = createAbstraction<IAuditParserService>(
    "Shared/AuditParserService"
);

export namespace AuditParserService {
    export type Interface = IAuditParserService;
    export type Input = IAuditParserInput;
}
