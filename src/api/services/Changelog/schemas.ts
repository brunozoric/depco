import { z } from "zod";

export const githubReleasesSchema = z.array(
    z.object({
        tag_name: z.string(),
        body: z.string().nullable().default(null)
    })
);

export const githubContentsSchema = z.object({
    content: z.string().optional(),
    encoding: z.string().optional()
});
