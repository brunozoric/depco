import { createAbstraction } from "#shared/index.js";
import type { PackageManagerDriver } from "./PackageManagerDriver.js";

export interface IPackageManagerDriverRegistry {
    getDriver(packageManager: string): PackageManagerDriver.Interface;
    getAllDrivers(): PackageManagerDriver.Interface[];
}

export const PackageManagerDriverRegistry = createAbstraction<IPackageManagerDriverRegistry>(
    "Api/PackageManagerDriverRegistry"
);

export namespace PackageManagerDriverRegistry {
    export type Interface = IPackageManagerDriverRegistry;
}
