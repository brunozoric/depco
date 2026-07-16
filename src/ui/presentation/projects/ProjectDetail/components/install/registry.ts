import type React from "react";
import type { PackageManagerId } from "#shared/security/index.js";
import type { ProjectsGateway } from "#ui/features/projects/abstractions/ProjectsGateway.js";
import { NpmInstallOptions } from "./NpmInstallOptions.js";
import { YarnInstallOptions } from "./YarnInstallOptions.js";
import { PnpmInstallOptions } from "./PnpmInstallOptions.js";
import { BunInstallOptions } from "./BunInstallOptions.js";

export interface InstallOptionsProps {
    flags: ProjectsGateway.InstallFlagDefinition[];
    selected: string[];
    onToggle: (flag: string) => void;
}

export type InstallOptionsComponent = React.ComponentType<InstallOptionsProps>;

export const INSTALL_OPTIONS_COMPONENTS: Record<PackageManagerId, InstallOptionsComponent> = {
    npm: NpmInstallOptions,
    yarn: YarnInstallOptions,
    pnpm: PnpmInstallOptions,
    bun: BunInstallOptions
};
