import { createAbstraction } from "#shared/index.js";

export interface IToggleSecuritySettingUseCase {
    execute(id: string): Promise<void>;
}

export const ToggleSecuritySettingUseCase = createAbstraction<IToggleSecuritySettingUseCase>(
    "Ui/ToggleSecuritySettingUseCase"
);

export namespace ToggleSecuritySettingUseCase {
    export type Interface = IToggleSecuritySettingUseCase;
}
