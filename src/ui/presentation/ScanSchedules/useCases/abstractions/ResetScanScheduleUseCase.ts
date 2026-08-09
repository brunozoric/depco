import { createAbstraction } from "#shared/index.js";

export interface IResetScanScheduleUseCase {
    execute(projectId: string): Promise<void>;
}

export const ResetScanScheduleUseCase = createAbstraction<IResetScanScheduleUseCase>(
    "Ui/ResetScanScheduleUseCase"
);

export namespace ResetScanScheduleUseCase {
    export type Interface = IResetScanScheduleUseCase;
}
