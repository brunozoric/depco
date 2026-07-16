import { z } from "zod";
import { toBoolean } from "@webiny/stdlib";
import type { SecurityFieldDefinition } from "./types.js";

export const PNPM_SECURITY_FIELDS: SecurityFieldDefinition[] = [
    {
        fieldName: "ignoreScripts",
        configFile: "pnpm-workspace.yaml",
        description: "Prevent lifecycle scripts from running during install",
        helperText:
            "Set to true to block pre/post-install scripts. Mitigates supply-chain attacks via malicious lifecycle hooks.",
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
        fieldName: "strictSsl",
        configFile: "pnpm-workspace.yaml",
        description: "Require valid SSL certificates for registry connections",
        helperText:
            "Set to true to reject invalid or self-signed certificates. Prevents man-in-the-middle attacks on registry traffic.",
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
        fieldName: "strictPeerDependencies",
        configFile: "pnpm-workspace.yaml",
        description: "Fail install on unmet peer dependencies",
        helperText:
            "Set to true to treat unmet peer dependencies as errors. Catches version mismatches that could cause runtime failures.",
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
        fieldName: "minimumReleaseAge",
        configFile: "pnpm-workspace.yaml",
        description: "Minimum age in minutes a package version must have before install",
        helperText:
            "Value in minutes. Example: 4320 = 3 days, 1440 = 1 day. Versions published more recently are blocked.",
        inputType: "duration",
        expectedValueSchema: z
            .string()
            .regex(/^\d+$/, "Must be a number in minutes (e.g. 4320 for 3 days)"),
        defaultExpectedValue: "4320",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            const actualMinutes = Number(actual);
            const expectedMinutes = Number(expected);
            if (Number.isNaN(actualMinutes) || Number.isNaN(expectedMinutes)) {
                return false;
            }
            return actualMinutes >= expectedMinutes;
        }
    },
    {
        fieldName: "minimumReleaseAgeStrict",
        configFile: "pnpm-workspace.yaml",
        description: "Strictly fail installation if a package is too new",
        helperText:
            "Set to true to fail the install when a version is too new. When false, pnpm rolls back to the last safe older version instead.",
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
        fieldName: "strictDepBuilds",
        configFile: "pnpm-workspace.yaml",
        description: "Exit with non-zero code if dependencies have unreviewed build scripts",
        helperText:
            "Set to true to require explicit approval of dependency build scripts. Prevents silent execution of unreviewed scripts.",
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
        fieldName: "blockExoticSubdeps",
        configFile: "pnpm-workspace.yaml",
        description: "Block transitive dependencies from exotic sources",
        helperText:
            "Set to true to only allow transitive dependencies from trusted sources (registries, workspace links). Prevents supply-chain attacks via git/URL dependencies in subdeps.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare(actual: unknown, expected: string): boolean {
            if (actual == null) {
                return false;
            }
            return toBoolean(actual) === toBoolean(expected);
        }
    }
];
