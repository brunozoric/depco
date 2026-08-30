import { z } from "zod";

export interface IRootPackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

export const rootPackageJsonSchema = z.object({
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional()
});

export function parseRootPackageJson(content: string): IRootPackageJson {
    try {
        const result = rootPackageJsonSchema.safeParse(JSON.parse(content));
        if (!result.success) {
            return {};
        }
        return result.data as IRootPackageJson;
    } catch {
        return {};
    }
}
