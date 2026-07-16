import { createAbstraction } from "#shared/index.js";

export interface IUpsertAppSettingUseCase {
    execute(key: string, value: string): Promise<void>;
}

export const UpsertAppSettingUseCase = createAbstraction<IUpsertAppSettingUseCase>(
    "Ui/UpsertAppSettingUseCase"
);

export namespace UpsertAppSettingUseCase {
    export type Interface = IUpsertAppSettingUseCase;
}
