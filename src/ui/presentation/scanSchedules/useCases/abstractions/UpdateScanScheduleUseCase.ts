import { createAbstraction } from "#shared/index.js";

export interface IUpdateScanScheduleUseCase {
    execute(projectId: string, interval: string): Promise<void>;
}

export const UpdateScanScheduleUseCase = createAbstraction<IUpdateScanScheduleUseCase>(
    "Ui/UpdateScanScheduleUseCase"
);

export namespace UpdateScanScheduleUseCase {
    export type Interface = IUpdateScanScheduleUseCase;
}
