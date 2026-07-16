import type { z } from "zod";

export type PackageManagerId = "yarn" | "npm" | "pnpm" | "bun";

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
