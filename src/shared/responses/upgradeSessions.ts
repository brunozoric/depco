import { z } from "zod";

export const stepStateSchema = z.object({
    type: z.string(),
    status: z.enum(["pending", "active", "completed", "skipped"]),
    input: z.record(z.string(), z.unknown()),
    result: z.record(z.string(), z.unknown())
});

export const sessionSchema = z.object({
    id: z.string(),
    projectId: z.string(),
    status: z.string(),
    currentStep: z.string(),
    steps: z.array(stepStateSchema),
    stepOrder: z.array(z.string()),
    createdAt: z.number(),
    updatedAt: z.number()
});

export const createUpgradeSessionResponseSchema = z.object({ item: sessionSchema });

export const getUpgradeSessionResponseSchema = z.object({ item: sessionSchema });

export const executeUpgradeStepResponseSchema = z.object({ item: sessionSchema });

export const skipUpgradeStepResponseSchema = z.object({ item: sessionSchema });

export const abortUpgradeSessionResponseSchema = z.object({ item: sessionSchema });

export type CreateUpgradeSessionResponse = z.infer<typeof createUpgradeSessionResponseSchema>;
export type GetUpgradeSessionResponse = z.infer<typeof getUpgradeSessionResponseSchema>;
export type ExecuteUpgradeStepResponse = z.infer<typeof executeUpgradeStepResponseSchema>;
export type SkipUpgradeStepResponse = z.infer<typeof skipUpgradeStepResponseSchema>;
export type AbortUpgradeSessionResponse = z.infer<typeof abortUpgradeSessionResponseSchema>;
