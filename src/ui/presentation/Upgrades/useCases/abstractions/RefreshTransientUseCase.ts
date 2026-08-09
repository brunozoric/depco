import { createAbstraction } from "#shared/index.js";

export interface IRefreshTransientUseCase {
    execute(projectId: string): Promise<void>;
}

export const RefreshTransientUseCase = createAbstraction<IRefreshTransientUseCase>(
    "Ui/RefreshTransientUseCase"
);

export namespace RefreshTransientUseCase {
    export type Interface = IRefreshTransientUseCase;
}
