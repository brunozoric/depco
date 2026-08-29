import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitySeverity } from "../types.js";

export interface IOsvQueryInput {
    name: string;
    version: string;
}

export interface IOsvAdvisory {
    id: string;
    summary: string | null;
    severity: VulnerabilitySeverity;
    aliases: string[];
    advisoryUrl: string;
    vulnerableRange: string | null;
    fixVersion: string | null;
}

export interface IOsvQueryBatchInput {
    packages: IOsvQueryInput[];
}

export interface IOsvQueryService {
    queryBatch(input: IOsvQueryBatchInput): Promise<Map<string, IOsvAdvisory[]>>;
}

export const OsvQueryService = createAbstraction<IOsvQueryService>("Shared/OsvQueryService");

export namespace OsvQueryService {
    export type Interface = IOsvQueryService;
    export type Advisory = IOsvAdvisory;
    export type QueryInput = IOsvQueryInput;
    export type QueryBatchInput = IOsvQueryBatchInput;
}
