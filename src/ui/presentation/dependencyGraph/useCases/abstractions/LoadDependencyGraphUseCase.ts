import { createAbstraction } from "#shared/index.js";

export interface ILoadDependencyGraphUseCase {
    execute(projectId: string): Promise<void>;
}

export const LoadDependencyGraphUseCase = createAbstraction<ILoadDependencyGraphUseCase>(
    "Ui/LoadDependencyGraphUseCase"
);

export namespace LoadDependencyGraphUseCase {
    export type Interface = ILoadDependencyGraphUseCase;
}
