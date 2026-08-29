import { createAbstraction } from "#shared/index.js";
import type { VulnerabilitiesGateway } from "../../../../features/Vulnerabilities/abstractions/VulnerabilitiesGateway.js";

export interface IRefreshOsvCacheUseCase {
    execute(
        options: VulnerabilitiesGateway.RefreshOptions
    ): Promise<VulnerabilitiesGateway.RefreshResult>;
}

export const RefreshOsvCacheUseCase = createAbstraction<IRefreshOsvCacheUseCase>(
    "Ui/RefreshOsvCacheUseCase"
);

export namespace RefreshOsvCacheUseCase {
    export type Interface = IRefreshOsvCacheUseCase;
}
