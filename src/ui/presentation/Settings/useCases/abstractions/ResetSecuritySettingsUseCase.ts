import { createAbstraction } from "#shared/index.js";

export interface IResetSecuritySettingsUseCase {
    execute(packageManager: string): Promise<void>;
}

export const ResetSecuritySettingsUseCase = createAbstraction<IResetSecuritySettingsUseCase>(
    "Ui/ResetSecuritySettingsUseCase"
);

export namespace ResetSecuritySettingsUseCase {
    export type Interface = IResetSecuritySettingsUseCase;
}
