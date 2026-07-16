export { type IInstallFlagDefinition } from "./types.js";
export { YARN_INSTALL_FLAGS } from "./yarn.js";
export { NPM_INSTALL_FLAGS } from "./npm.js";
export { PNPM_INSTALL_FLAGS } from "./pnpm.js";
export { BUN_INSTALL_FLAGS } from "./bun.js";

import type { PackageManagerId } from "#shared/security/types.js";
import type { IInstallFlagDefinition } from "./types.js";
import { YARN_INSTALL_FLAGS } from "./yarn.js";
import { NPM_INSTALL_FLAGS } from "./npm.js";
import { PNPM_INSTALL_FLAGS } from "./pnpm.js";
import { BUN_INSTALL_FLAGS } from "./bun.js";

export const INSTALL_FLAG_REGISTRY: Record<PackageManagerId, IInstallFlagDefinition[]> = {
    yarn: YARN_INSTALL_FLAGS,
    npm: NPM_INSTALL_FLAGS,
    pnpm: PNPM_INSTALL_FLAGS,
    bun: BUN_INSTALL_FLAGS
};
