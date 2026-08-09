import { createAbstraction } from "#shared/index.js";
import type { TrendsGateway } from "../../../../features/Trends/abstractions/TrendsGateway.js";

export interface ILoadDependencyChangesUseCase {
    execute(filters?: TrendsGateway.DependencyChangesFilters): Promise<void>;
}

export const LoadDependencyChangesUseCase = createAbstraction<ILoadDependencyChangesUseCase>(
    "Ui/LoadDependencyChangesUseCase"
);

export namespace LoadDependencyChangesUseCase {
    export type Interface = ILoadDependencyChangesUseCase;
}
