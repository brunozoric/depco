import type { IInstallFlagDefinition } from "./types.js";

export const NPM_INSTALL_FLAGS: IInstallFlagDefinition[] = [
    {
        flag: "--omit=dev",
        label: "Omit dev",
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
        flag: "--legacy-peer-deps",
        label: "Legacy peers",
        description: "Ignore peer dependency conflicts",
        defaultEnabled: false
    },
    {
        flag: "--ignore-scripts",
        label: "Ignore scripts",
        description: "Skip lifecycle scripts",
        defaultEnabled: false
    }
];
