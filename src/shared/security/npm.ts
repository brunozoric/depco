import { z } from "zod";
import type { SecurityFieldDefinition } from "./types.js";
import { booleanCompare, durationCompare } from "./comparators.js";

export const NPM_SECURITY_FIELDS: SecurityFieldDefinition[] = [
    {
        fieldName: "ignore-scripts",
        configFile: ".npmrc",
        description: "Prevent lifecycle scripts from running during install",
        helperText:
            "Set to true to block pre/post-install scripts. Mitigates supply-chain attacks via malicious lifecycle hooks.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare: booleanCompare
    },
    {
        fieldName: "audit",
        configFile: ".npmrc",
        description: "Run npm audit automatically on install",
        helperText: "Set to true so every install checks for known vulnerabilities.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare: booleanCompare
    },
    {
        fieldName: "strict-ssl",
        configFile: ".npmrc",
        description: "Require valid SSL certificates for registry connections",
        helperText:
            "Set to true to reject invalid or self-signed certificates. Prevents man-in-the-middle attacks on registry traffic.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "true",
        compare: booleanCompare
    },
    {
        fieldName: "minimal-age-gate",
        configFile: ".npmrc",
        description: "Minimum age a package version must have before being offered as an upgrade",
        helperText:
            "Duration format: number + unit (d=days, h=hours, m=minutes, s=seconds). Example: 3d, 72h. Versions published more recently are excluded from scan results.",
        inputType: "duration",
        expectedValueSchema: z
            .string()
            .regex(/^\d+[dhms]$/, "Must be a duration like 3d, 72h, 30m"),
        defaultExpectedValue: "3d",
        compare: durationCompare
    }
];
