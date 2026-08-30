export {
    PACKAGE_MANAGER_IDS,
    type PackageManagerId,
    type SecurityFieldDefinition,
    type FieldInputType
} from "./types.js";
export { parseDuration } from "./duration.js";
export { YARN_SECURITY_FIELDS } from "./yarn.js";
export { NPM_SECURITY_FIELDS } from "./npm.js";
export { PNPM_SECURITY_FIELDS } from "./pnpm.js";
export { BUN_SECURITY_FIELDS } from "./bun.js";

import type { PackageManagerId, SecurityFieldDefinition } from "./types.js";
import { YARN_SECURITY_FIELDS } from "./yarn.js";
import { NPM_SECURITY_FIELDS } from "./npm.js";
import { PNPM_SECURITY_FIELDS } from "./pnpm.js";
import { BUN_SECURITY_FIELDS } from "./bun.js";

export const SECURITY_FIELD_REGISTRY: Record<PackageManagerId, SecurityFieldDefinition[]> = {
    yarn: YARN_SECURITY_FIELDS,
    npm: NPM_SECURITY_FIELDS,
    pnpm: PNPM_SECURITY_FIELDS,
    bun: BUN_SECURITY_FIELDS
};
