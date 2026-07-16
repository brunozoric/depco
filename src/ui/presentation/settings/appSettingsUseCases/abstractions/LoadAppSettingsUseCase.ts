import { createAbstraction } from "#shared/index.js";

export interface ILoadAppSettingsUseCase {
    execute(): Promise<void>;
}

export const LoadAppSettingsUseCase = createAbstraction<ILoadAppSettingsUseCase>(
    "Ui/LoadAppSettingsUseCase"
);

export namespace LoadAppSettingsUseCase {
    export type Interface = ILoadAppSettingsUseCase;
}
