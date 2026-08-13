import { z } from "zod";

export const getPackageManagerResponseSchema = z.object({
    item: z.object({ version: z.string() })
});

export const updatePackageManagerResponseSchema = z.object({
    item: z.object({ jobId: z.string() })
});
