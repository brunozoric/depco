import { EnginesRepository as Abstraction } from "./abstractions/EnginesRepository.js";
import type { EnginesGateway } from "./abstractions/EnginesGateway.js";

class EnginesRepositoryImpl implements Abstraction.Interface {
    private checks: EnginesGateway.CheckItem[] = [];
    private total = 0;
    private summary: EnginesGateway.SummaryData | null = null;
    private releases: EnginesGateway.NodeRelease[] = [];

    public getChecks(): EnginesGateway.CheckItem[] {
        return this.checks;
    }

    public getTotal(): number {
        return this.total;
    }

    public getSummary(): EnginesGateway.SummaryData | null {
        return this.summary;
    }

    public setChecks(items: EnginesGateway.CheckItem[], total: number): void {
        this.checks = items;
        this.total = total;
    }

    public setSummary(summary: EnginesGateway.SummaryData): void {
        this.summary = summary;
    }

    public getReleases(): EnginesGateway.NodeRelease[] {
        return this.releases;
    }

    public setReleases(items: EnginesGateway.NodeRelease[]): void {
        this.releases = items;
    }
}

export const EnginesRepository = Abstraction.createImplementation({
    implementation: EnginesRepositoryImpl,
    dependencies: []
});
