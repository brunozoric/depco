import { UpgradeSessionsRepository as Abstraction } from "./abstractions/UpgradeSessionsRepository.js";
import type { UpgradeSessionsGateway } from "./abstractions/UpgradeSessionsGateway.js";

class UpgradeSessionsRepositoryImpl implements Abstraction.Interface {
    private session: UpgradeSessionsGateway.SessionResponse | null = null;

    public getSession(): UpgradeSessionsGateway.SessionResponse | null {
        return this.session;
    }

    public setSession(session: UpgradeSessionsGateway.SessionResponse | null): void {
        this.session = session;
    }
}

export const UpgradeSessionsRepository = Abstraction.createImplementation({
    implementation: UpgradeSessionsRepositoryImpl,
    dependencies: []
});
