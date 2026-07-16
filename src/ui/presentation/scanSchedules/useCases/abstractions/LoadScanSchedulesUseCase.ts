import { createAbstraction } from "#shared/index.js";

export interface ILoadScanSchedulesUseCase {
    execute(): Promise<void>;
}

export const LoadScanSchedulesUseCase = createAbstraction<ILoadScanSchedulesUseCase>(
    "Ui/LoadScanSchedulesUseCase"
);

export namespace LoadScanSchedulesUseCase {
    export type Interface = ILoadScanSchedulesUseCase;
}
