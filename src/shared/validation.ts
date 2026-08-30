import type { z } from "zod";

export function formatZodError(issues: z.ZodIssue[]): string {
    return issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}
