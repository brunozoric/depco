import { z } from "zod";
import { jobHandleResponseSchema } from "./jobs.js";

export const installProjectResponseSchema = jobHandleResponseSchema;

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
