import { createAbstraction } from "#shared/index.js";

export interface IUpdateSecuritySettingUseCase {
    execute(id: string, expectedValue: string): Promise<void>;
}

export const UpdateSecuritySettingUseCase = createAbstraction<IUpdateSecuritySettingUseCase>(
    "Ui/UpdateSecuritySettingUseCase"
);

export namespace UpdateSecuritySettingUseCase {
    export type Interface = IUpdateSecuritySettingUseCase;
}
