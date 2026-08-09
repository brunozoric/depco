import { createAbstraction } from "#shared/index.js";

export interface IGetJobsUseCase {
    execute(projectId: string): Promise<void>;
}

export const GetJobsUseCase = createAbstraction<IGetJobsUseCase>("Ui/GetJobsUseCase");

export namespace GetJobsUseCase {
    export type Interface = IGetJobsUseCase;
}
