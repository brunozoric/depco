import { createAbstraction } from "#shared/index.js";
import type { AutoFixGateway } from "./AutoFixGateway.js";

export interface IAutoFixRepository {
    getSettings(): AutoFixGateway.Settings | null;
    setSettings(settings: AutoFixGateway.Settings): void;
    getPullRequests(): AutoFixGateway.PullRequest[];
    getPullRequestsTotal(): number;
    setPullRequests(items: AutoFixGateway.PullRequest[], total: number): void;
}

export const AutoFixRepository = createAbstraction<IAutoFixRepository>("Ui/AutoFixRepository");

export namespace AutoFixRepository {
    export type Interface = IAutoFixRepository;
}
