import { createAbstraction } from "#shared/index.js";
import type { TeamsGateway } from "../../../../features/Teams/abstractions/TeamsGateway.js";

export interface IManageTeamUseCase {
    create(input: TeamsGateway.CreateInput): Promise<TeamsGateway.WithStats>;
    update(id: string, input: TeamsGateway.UpdateInput): Promise<void>;
    remove(id: string): Promise<void>;
}

export const ManageTeamUseCase = createAbstraction<IManageTeamUseCase>("Ui/ManageTeamUseCase");

export namespace ManageTeamUseCase {
    export type Interface = IManageTeamUseCase;
}
