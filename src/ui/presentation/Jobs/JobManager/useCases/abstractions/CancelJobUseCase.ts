import { createAbstraction } from "#shared/index.js";

export interface ICancelJobUseCase {
    execute(jobId: string): Promise<void>;
}

export const CancelJobUseCase = createAbstraction<ICancelJobUseCase>("Ui/CancelJobUseCase");

export namespace CancelJobUseCase {
    export type Interface = ICancelJobUseCase;
}
