import { createAbstraction } from "#shared/index.js";

export interface ICheckSecurityUseCase {
    execute(id: string): Promise<void>;
}

export const CheckSecurityUseCase =
    createAbstraction<ICheckSecurityUseCase>("Ui/CheckSecurityUseCase");

export namespace CheckSecurityUseCase {
    export type Interface = ICheckSecurityUseCase;
}
