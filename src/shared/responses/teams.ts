import { z } from "zod";

export const teamWithStatsSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    createdAt: z.number(),
    projectCount: z.number(),
    vulnerabilityCount: z.number(),
    compliantPercent: z.number(),
    averageHealthScore: z.number()
});

export const teamDetailSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    createdAt: z.number(),
    projects: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            path: z.string()
        })
    )
});

export const listTeamsResponseSchema = z.object({
    items: z.array(teamWithStatsSchema),
    total: z.number()
});

export const createTeamResponseSchema = z.object({
    item: teamWithStatsSchema
});

export const getTeamDetailResponseSchema = z.object({
    item: teamDetailSchema
});

export const updateTeamResponseSchema = z.object({
    item: teamWithStatsSchema
});
