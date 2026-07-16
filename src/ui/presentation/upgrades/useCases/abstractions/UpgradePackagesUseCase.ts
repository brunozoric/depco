import { createAbstraction } from "#shared/index.js";
import type { UpgradesGateway } from "../../../../features/upgrades/abstractions/UpgradesGateway.js";

export interface IUpgradePackagesUseCase {
    execute(
        projectId: string,
        packages: UpgradesGateway.UpgradePackageInput[],
        refreshTransient: boolean
    ): Promise<void>;
}

export const UpgradePackagesUseCase = createAbstraction<IUpgradePackagesUseCase>(
    "Ui/UpgradePackagesUseCase"
);

export namespace UpgradePackagesUseCase {
    export type Interface = IUpgradePackagesUseCase;
    export type PackageInput = UpgradesGateway.UpgradePackageInput;
}
