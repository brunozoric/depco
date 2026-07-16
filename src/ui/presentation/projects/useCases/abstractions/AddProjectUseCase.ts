import { createAbstraction } from "#shared/index.js";

export interface IAddProjectUseCase {
    execute(path: string): Promise<void>;
}

export const AddProjectUseCase = createAbstraction<IAddProjectUseCase>("Ui/AddProjectUseCase");

export namespace AddProjectUseCase {
    export type Interface = IAddProjectUseCase;
}
