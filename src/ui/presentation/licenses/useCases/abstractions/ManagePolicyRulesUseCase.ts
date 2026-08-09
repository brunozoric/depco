import { createAbstraction } from "#shared/index.js";
import type { LicensesGateway } from "../../../../features/Licenses/abstractions/LicensesGateway.js";

export interface IManagePolicyRulesUseCase {
    create(input: LicensesGateway.CreatePolicyInput): Promise<void>;
    update(id: string, input: LicensesGateway.UpdatePolicyInput): Promise<void>;
    remove(id: string): Promise<void>;
}

export const ManagePolicyRulesUseCase = createAbstraction<IManagePolicyRulesUseCase>(
    "Ui/ManagePolicyRulesUseCase"
);

export namespace ManagePolicyRulesUseCase {
    export type Interface = IManagePolicyRulesUseCase;
}
