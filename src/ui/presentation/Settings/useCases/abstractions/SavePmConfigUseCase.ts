import { createAbstraction } from "#shared/index.js";
import type { PmSettingsGateway } from "../../../../features/Settings/abstractions/PmSettingsGateway.js";

export interface ISavePmConfigUseCase {
    execute(pm: string, settings: PmSettingsGateway.UpdatePmConfigBody): Promise<void>;
}

export const SavePmConfigUseCase =
    createAbstraction<ISavePmConfigUseCase>("Ui/SavePmConfigUseCase");

export namespace SavePmConfigUseCase {
    export type Interface = ISavePmConfigUseCase;
}
