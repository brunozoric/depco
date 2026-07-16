import { createAbstraction } from "#shared/index.js";
import { UpgradeSessionsGateway } from "./UpgradeSessionsGateway.js";

export interface IUpgradeSessionsRepository {
    getSession(): UpgradeSessionsGateway.SessionResponse | null;
    setSession(session: UpgradeSessionsGateway.SessionResponse | null): void;
}

export const UpgradeSessionsRepository = createAbstraction<IUpgradeSessionsRepository>(
    "Ui/UpgradeSessionsRepository"
);

export namespace UpgradeSessionsRepository {
    export type Interface = IUpgradeSessionsRepository;
}
