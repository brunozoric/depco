import { createAbstraction } from "#shared/index.js";

export interface ICreateSecuritySettingUseCase {
    execute(packageManager: string, fieldName: string, expectedValue: string): Promise<void>;
}

export const CreateSecuritySettingUseCase = createAbstraction<ICreateSecuritySettingUseCase>(
    "Ui/CreateSecuritySettingUseCase"
);

export namespace CreateSecuritySettingUseCase {
    export type Interface = ICreateSecuritySettingUseCase;
}
