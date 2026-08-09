import { createAbstraction } from "#shared/index.js";

export interface IUpdateScanScheduleDefaultUseCase {
    execute(interval: string): Promise<void>;
}

export const UpdateScanScheduleDefaultUseCase =
    createAbstraction<IUpdateScanScheduleDefaultUseCase>("Ui/UpdateScanScheduleDefaultUseCase");

export namespace UpdateScanScheduleDefaultUseCase {
    export type Interface = IUpdateScanScheduleDefaultUseCase;
}
