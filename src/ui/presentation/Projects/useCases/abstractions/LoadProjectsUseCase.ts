import { createAbstraction } from "#shared/index.js";
import type { ProjectsGateway } from "../../../../features/Projects/abstractions/ProjectsGateway.js";

export interface ILoadProjectsUseCase {
    execute(params?: ProjectsGateway.ListParams): Promise<void>;
}

export const LoadProjectsUseCase =
    createAbstraction<ILoadProjectsUseCase>("Ui/LoadProjectsUseCase");

export namespace LoadProjectsUseCase {
    export type Interface = ILoadProjectsUseCase;
}
