import { createAbstraction } from "#shared/index.js";

export interface ILoadSecuritySettingsUseCase {
    execute(): Promise<void>;
}

export const LoadSecuritySettingsUseCase = createAbstraction<ILoadSecuritySettingsUseCase>(
    "Ui/LoadSecuritySettingsUseCase"
);

export namespace LoadSecuritySettingsUseCase {
    export type Interface = ILoadSecuritySettingsUseCase;
}
