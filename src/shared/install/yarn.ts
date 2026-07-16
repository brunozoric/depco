import type { IInstallFlagDefinition } from "./types.js";

export const YARN_INSTALL_FLAGS: IInstallFlagDefinition[] = [
    {
        flag: "--immutable",
        label: "Immutable",
        description: "Fail if lockfile would change",
        defaultEnabled: false
    },
    {
        flag: "--production",
        label: "Production",
        description: "Skip devDependencies",
        defaultEnabled: false
    },
    {
        flag: "--force",
        label: "Force",
        description: "Refetch all packages",
        defaultEnabled: false
    },
    {
        flag: "--ignore-scripts",
        label: "Ignore scripts",
        description: "Skip lifecycle scripts",
        defaultEnabled: false
    }
];
