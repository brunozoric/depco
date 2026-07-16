import { createAbstraction } from "#shared/index.js";

export interface IUpdatePackageManagerUseCase {
    execute(projectId: string, version: string): Promise<void>;
}

export const UpdatePackageManagerUseCase = createAbstraction<IUpdatePackageManagerUseCase>(
    "Ui/UpdatePackageManagerUseCase"
);

export namespace UpdatePackageManagerUseCase {
    export type Interface = IUpdatePackageManagerUseCase;
}
