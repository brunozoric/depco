import { z } from "zod";

const licenseSchema = z
    .union([
        z.string(),
        z.object({ type: z.string().optional() }).passthrough(),
        z.null(),
        z.undefined()
    ])
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
    return licenseSchema.parse(value);
}
