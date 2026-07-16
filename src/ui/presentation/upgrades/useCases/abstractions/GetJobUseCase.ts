import { createAbstraction } from "#shared/index.js";

export interface IGetJobUseCase {
    execute(projectId: string, jobId: string): Promise<void>;
}

export const GetJobUseCase = createAbstraction<IGetJobUseCase>("Ui/GetJobUseCase");

export namespace GetJobUseCase {
    export type Interface = IGetJobUseCase;
}
