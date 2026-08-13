import { z } from "zod";

export const successResponseSchema = z.object({ success: z.literal(true) });
