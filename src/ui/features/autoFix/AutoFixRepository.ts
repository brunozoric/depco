import { AutoFixRepository as Abstraction } from "./abstractions/AutoFixRepository.js";
import type { AutoFixGateway } from "./abstractions/AutoFixGateway.js";

class AutoFixRepositoryImpl implements Abstraction.Interface {
    private settings: AutoFixGateway.Settings | null = null;
    private pullRequests: AutoFixGateway.PullRequest[] = [];
    private pullRequestsTotal = 0;

    public getSettings(): AutoFixGateway.Settings | null {
        return this.settings;
    }

    public setSettings(settings: AutoFixGateway.Settings): void {
        this.settings = settings;
    }

    public getPullRequests(): AutoFixGateway.PullRequest[] {
        return this.pullRequests;
    }

    public getPullRequestsTotal(): number {
        return this.pullRequestsTotal;
    }

    public setPullRequests(items: AutoFixGateway.PullRequest[], total: number): void {
        this.pullRequests = items;
        this.pullRequestsTotal = total;
    }
}

export const AutoFixRepository = Abstraction.createImplementation({
    implementation: AutoFixRepositoryImpl,
    dependencies: []
});
