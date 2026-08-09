import { PackagesRepository as Abstraction } from "./abstractions/PackagesRepository.js";
import type { PackagesGateway } from "./abstractions/PackagesGateway.js";

class PackagesRepositoryImpl implements Abstraction.Interface {
    private packages: PackagesGateway.PackageListItem[] = [];
    private total = 0;

    public getPackages(): PackagesGateway.PackageListItem[] {
        return this.packages;
    }

    public getTotal(): number {
        return this.total;
    }

    public setPackages(packages: PackagesGateway.PackageListItem[], total: number): void {
        this.packages = packages;
        this.total = total;
    }
}

export const PackagesRepository = Abstraction.createImplementation({
    implementation: PackagesRepositoryImpl,
    dependencies: []
});
