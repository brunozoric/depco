import { z } from "zod";

export const githubReleasesSchema = z.array(
    z.object({
        tag_name: z.string(),
        body: z.string().nullable().default(null)
    })
);
