import { createAbstraction } from "#shared/index.js";
import { PackagesGateway } from "./PackagesGateway.js";

export interface IPackagesRepository {
    getPackages(): PackagesGateway.PackageListItem[];
    getTotal(): number;
    setPackages(packages: PackagesGateway.PackageListItem[], total: number): void;
}

export const PackagesRepository = createAbstraction<IPackagesRepository>("Ui/PackagesRepository");

export namespace PackagesRepository {
    export type Interface = IPackagesRepository;
}
