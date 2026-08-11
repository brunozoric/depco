import { createAbstraction } from "#shared/index.js";
import type { EnginesGateway } from "./EnginesGateway.js";

export interface IEnginesRepository {
    getChecks(): EnginesGateway.CheckItem[];
    getTotal(): number;
    getSummary(): EnginesGateway.SummaryData | null;
    setChecks(items: EnginesGateway.CheckItem[], total: number): void;
    setSummary(summary: EnginesGateway.SummaryData): void;
    getReleases(): EnginesGateway.NodeRelease[];
    setReleases(items: EnginesGateway.NodeRelease[]): void;
}

export const EnginesRepository = createAbstraction<IEnginesRepository>("Ui/EnginesRepository");

export namespace EnginesRepository {
    export type Interface = IEnginesRepository;
}
