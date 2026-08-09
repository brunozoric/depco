import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

export interface IRefreshOsvCacheUseCase {
    execute(options: VulnerabilitiesGateway.RefreshOptions): Promise<{ invalidated: number }>;
}

export const RefreshOsvCacheUseCase = createAbstraction<IRefreshOsvCacheUseCase>(
    "Ui/RefreshOsvCacheUseCase"
);

export namespace RefreshOsvCacheUseCase {
    export type Interface = IRefreshOsvCacheUseCase;
}
