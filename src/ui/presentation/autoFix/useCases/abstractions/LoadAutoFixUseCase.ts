import { createAbstraction } from "#shared/index.js";

export interface ILoadAutoFixUseCase {
    execute(projectId: string): Promise<void>;
}

export const LoadAutoFixUseCase = createAbstraction<ILoadAutoFixUseCase>("Ui/LoadAutoFixUseCase");

export namespace LoadAutoFixUseCase {
    export type Interface = ILoadAutoFixUseCase;
}
