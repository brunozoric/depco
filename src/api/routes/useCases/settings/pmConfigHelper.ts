import type { PackageManagerId } from "#shared/security/index.js";
import { INSTALL_FLAG_REGISTRY } from "#shared/install/index.js";
import type { FileConfigService } from "#api/services/FileConfig/index.js";

export const ALL_PACKAGE_MANAGERS: PackageManagerId[] = ["yarn", "npm", "pnpm", "bun"];

export interface IInstallFlagItemResponse {
    flag: string;
    label: string;
    description: string;
    enabled: boolean;
    defaultEnabled: boolean;
    isFileManaged: boolean;
}

export interface IPmGeneralSettingsResponse {
    registryUrl: string | null;
    upgradeStrategy: string | null;
}

export interface IPmConfigItemResponse {
    packageManager: string;
    installFlags: IInstallFlagItemResponse[];
    general: IPmGeneralSettingsResponse;
}

export function buildDefaultPmItems(): IPmConfigItemResponse[] {
    return ALL_PACKAGE_MANAGERS.map(pm => ({
        packageManager: pm,
        installFlags: INSTALL_FLAG_REGISTRY[pm].map(flag => ({
            flag: flag.flag,
            label: flag.label,
            description: flag.description,
            enabled: flag.defaultEnabled,
            defaultEnabled: flag.defaultEnabled,
            isFileManaged: false
        })),
        general: { registryUrl: null, upgradeStrategy: null }
    }));
}

export function buildPmConfigItem(
    pm: PackageManagerId,
    fileConfig: FileConfigService.PmSettings | undefined,
    isManaged: boolean
): IPmConfigItemResponse {
    const registry = INSTALL_FLAG_REGISTRY[pm];

    const installFlags: IInstallFlagItemResponse[] = registry.map(flag => {
        const fileValue = fileConfig?.installFlags?.[flag.flag];
        return {
            flag: flag.flag,
            label: flag.label,
            description: flag.description,
            enabled: fileValue ?? flag.defaultEnabled,
            defaultEnabled: flag.defaultEnabled,
            isFileManaged: isManaged && fileValue !== undefined
        };
    });

    return {
        packageManager: pm,
        installFlags,
        general: {
            registryUrl: fileConfig?.registryUrl ?? null,
            upgradeStrategy: fileConfig?.upgradeStrategy ?? null
        }
    };
}
