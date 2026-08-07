import { createAbstraction } from "#shared/index.js";

export interface IForceLogoutUserUseCase {
    execute(id: string): Promise<void>;
}

export const ForceLogoutUserUseCase = createAbstraction<IForceLogoutUserUseCase>(
    "Ui/ForceLogoutUserUseCase"
);

export namespace ForceLogoutUserUseCase {
    export type Interface = IForceLogoutUserUseCase;
}
