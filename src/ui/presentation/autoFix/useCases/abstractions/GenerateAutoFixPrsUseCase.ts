import { createAbstraction } from "#shared/index.js";
import type { AutoFixGateway } from "../../../../features/autoFix/abstractions/AutoFixGateway.js";

export interface IGenerateAutoFixPrsUseCase {
    execute(projectId: string): Promise<AutoFixGateway.GenerateResult>;
}

export const GenerateAutoFixPrsUseCase = createAbstraction<IGenerateAutoFixPrsUseCase>(
    "Ui/GenerateAutoFixPrsUseCase"
);

export namespace GenerateAutoFixPrsUseCase {
    export type Interface = IGenerateAutoFixPrsUseCase;
}
