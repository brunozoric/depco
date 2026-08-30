import { z } from "zod";
import type { SecurityFieldDefinition } from "./types.js";
import { booleanCompare, existsCompare, durationCompare } from "./comparators.js";

export const YARN_SECURITY_FIELDS: SecurityFieldDefinition[] = [
    {
        fieldName: "npmPreapprovedPackages",
        configFile: ".yarnrc.yml",
        description: "Pre-approved packages that skip audit checks",
        helperText:
            "Field must exist in .yarnrc.yml. Array of package descriptors or name glob patterns excluded from all package gates.",
        inputType: "exists",
        expectedValueSchema: z.literal("exists"),
        defaultExpectedValue: "exists",
        compare: existsCompare
    },
    {
        fieldName: "npmMinimalAgeGate",
        configFile: ".yarnrc.yml",
        description: "Minimum age a package version must have before install",
        helperText:
            "Duration format: number + unit (d=days, h=hours, m=minutes, s=seconds). Example: 3d, 72h",
        inputType: "duration",
        expectedValueSchema: z
            .string()
            .regex(/^\d+[dhms]$/, "Must be a duration like 3d, 72h, 30m"),
        defaultExpectedValue: "3d",
        compare: durationCompare
    },
    {
        fieldName: "enableScripts",
        configFile: ".yarnrc.yml",
        description: "Whether lifecycle scripts are allowed to run during install",
        helperText: "Set to false to prevent lifecycle scripts from running. More secure.",
        inputType: "boolean",
        expectedValueSchema: z.enum(["true", "false"]),
        defaultExpectedValue: "false",
        compare: booleanCompare
    },
    {
        fieldName: "approvedGitRepositories",
        configFile: ".yarnrc.yml",
        description: "Approved git repositories for git: dependencies",
        helperText: "Field must exist in .yarnrc.yml. List of approved git repository patterns.",
        inputType: "exists",
        expectedValueSchema: z.literal("exists"),
        defaultExpectedValue: "exists",
        compare: existsCompare
    }
];
