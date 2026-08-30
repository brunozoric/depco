import { z } from "zod";
import { jobHandleResponseSchema } from "./jobs.js";

export const getPackageManagerResponseSchema = z.object({
    item: z.object({ version: z.string() })
});

export const updatePackageManagerResponseSchema = jobHandleResponseSchema;
