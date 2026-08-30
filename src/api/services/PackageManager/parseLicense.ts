import { formatZodError } from "#shared/index.js";
import { z } from "zod";

const licenseSchema = z
    .union([z.string(), z.looseObject({ type: z.string().optional() }), z.null(), z.undefined()])
    .transform(value => {
        if (!value) {
            return null;
        }
        if (typeof value === "object") {
            return value.type?.trim() || null;
        }
        return value.trim() || null;
    });

export function parseLicense(value: unknown): string | null {
    const parsed = licenseSchema.safeParse(value);
    if (!parsed.success) {
        throw new Error(formatZodError(parsed.error.issues));
    }
    return parsed.data;
}
