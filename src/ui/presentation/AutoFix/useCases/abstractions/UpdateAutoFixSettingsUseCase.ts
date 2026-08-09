import { createAbstraction } from "#shared/index.js";
import type { AutoFixGateway } from "../../../../features/AutoFix/abstractions/AutoFixGateway.js";

export interface IUpdateAutoFixSettingsUseCase {
    execute(projectId: string, input: AutoFixGateway.UpdateSettingsInput): Promise<void>;
}

export const UpdateAutoFixSettingsUseCase = createAbstraction<IUpdateAutoFixSettingsUseCase>(
    "Ui/UpdateAutoFixSettingsUseCase"
);

export namespace UpdateAutoFixSettingsUseCase {
    export type Interface = IUpdateAutoFixSettingsUseCase;
}
