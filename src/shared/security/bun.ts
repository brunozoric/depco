import { z } from "zod";
import { toBoolean } from "@webiny/stdlib";
import type { SecurityFieldDefinition } from "./types.js";

export const BUN_SECURITY_FIELDS: SecurityFieldDefinition[] = [
    {
        fieldName: "trustedDependencies",
        configFile: "package.json",
        description: "Allowlist of packages permitted to run lifecycle scripts",
        helperText:
            "Bun blocks lifecycle scripts by default. Only packages listed in trustedDependencies can run install scripts. Field must exist as an array.",
        inputType: "exists",
        expectedValueSchema: z.literal("exists"),
        defaultExpectedValue: "exists",
        compare(actual: unknown, _expected: string): boolean {
            return actual != null && Array.isArray(actual);
        }
    },
    {
        fieldName: "install.exact",
        configFile: "bunfig.toml",
        description: "Use exact versions instead of semver ranges",
        helperText:
            "Set to true so bun add writes exact versions. Prevents semver ranges from pulling unexpected updates.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.frozen",
        configFile: "bunfig.toml",
        description: "Prevent lockfile modifications during install",
        helperText:
            "Set to true to enforce lockfile integrity. Bun will error if the lockfile would change, ensuring reproducible installs.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.saveTextLockfile",
        configFile: "bunfig.toml",
        description: "Save human-readable text lockfile for code review",
        helperText:
            "Set to true to save a text lockfile alongside the binary one. Aids code review and audit of dependency changes.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.production",
        configFile: "bunfig.toml",
        description: "Skip devDependencies in production",
        helperText:
            "Set to true to exclude devDependencies during install. Reduces attack surface in production environments.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "false",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.peer",
        configFile: "bunfig.toml",
        description: "Auto-install peer dependencies",
        helperText:
            "Set to true to automatically install peer dependencies. Prevents missing peer runtime errors.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.optional",
        configFile: "bunfig.toml",
        description: "Install optionalDependencies",
        helperText:
            "Set to true to install optionalDependencies. Set to false to skip them for leaner installs.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    },
    {
        fieldName: "install.auto",
        configFile: "bunfig.toml",
        description: "Auto-install dependencies on import",
        helperText:
            "Set to false to disable auto-install on import. Gives stricter control over when dependencies are fetched.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "false",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    }
];
