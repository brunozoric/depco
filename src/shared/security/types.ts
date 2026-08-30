import type { z } from "zod";

export const PACKAGE_MANAGER_IDS = ["yarn", "npm", "pnpm", "bun"] as const;
export type PackageManagerId = (typeof PACKAGE_MANAGER_IDS)[number];

export type FieldInputType = "exists" | "duration" | "boolean";

export interface SecurityFieldDefinition {
    fieldName: string;
    configFile: string;
    description: string;
    helperText: string;
    inputType: FieldInputType;
    expectedValueSchema: z.ZodType<string>;
    defaultExpectedValue: string;
    compare(actual: unknown, expected: string): boolean;
}
