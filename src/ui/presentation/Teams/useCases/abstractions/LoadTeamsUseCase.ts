import { createAbstraction } from "#shared/index.js";

export interface ILoadTeamsUseCase {
    execute(): Promise<void>;
}

export const LoadTeamsUseCase = createAbstraction<ILoadTeamsUseCase>("Ui/LoadTeamsUseCase");

export namespace LoadTeamsUseCase {
    export type Interface = ILoadTeamsUseCase;
}
