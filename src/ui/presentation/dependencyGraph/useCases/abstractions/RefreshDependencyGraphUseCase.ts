import { createAbstraction } from "#shared/index.js";

export interface IRefreshDependencyGraphUseCase {
    execute(projectId: string): Promise<void>;
}

export const RefreshDependencyGraphUseCase = createAbstraction<IRefreshDependencyGraphUseCase>(
    "Ui/RefreshDependencyGraphUseCase"
);

export namespace RefreshDependencyGraphUseCase {
    export type Interface = IRefreshDependencyGraphUseCase;
}
