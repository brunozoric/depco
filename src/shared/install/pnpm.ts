import type { IInstallFlagDefinition } from "./types.js";

export const PNPM_INSTALL_FLAGS: IInstallFlagDefinition[] = [
    {
        flag: "--frozen-lockfile",
        label: "Frozen lockfile",
        description: "Fail if lockfile is outdated",
        defaultEnabled: false
    },
    {
        flag: "--prod",
        label: "Production",
        description: "Skip devDependencies",
        defaultEnabled: false
    },
    {
        flag: "--force",
        label: "Force",
        description: "Force reinstall all packages",
        defaultEnabled: false
    },
    {
        flag: "--ignore-scripts",
        label: "Ignore scripts",
        description: "Skip lifecycle scripts",
        defaultEnabled: false
    }
];
