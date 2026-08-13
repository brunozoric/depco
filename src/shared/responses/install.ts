import { z } from "zod";

export const installProjectResponseSchema = z.object({
    item: z.object({ jobId: z.string() })
});

export const getInstallOptionsResponseSchema = z.object({
    items: z.array(
        z.object({
            flag: z.string(),
            label: z.string(),
            description: z.string(),
            exclusive: z.string().optional(),
            defaultEnabled: z.boolean()
        })
    ),
    total: z.number()
});
