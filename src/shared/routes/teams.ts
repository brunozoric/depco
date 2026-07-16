import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const teamWithStatsSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    createdAt: z.number(),
    projectCount: z.number(),
    vulnerabilityCount: z.number(),
    compliantPercent: z.number(),
    averageHealthScore: z.number()
});

export const listTeamsRoute = defineRoute({
    method: "GET",
    path: "/api/teams",
    description: "List all teams with aggregate stats",
    params: z.object({}),
    response: z.object({ items: z.array(teamWithStatsSchema), total: z.number() })
});

export const createTeamRoute = defineRoute({
    method: "POST",
    path: "/api/teams",
    description: "Create a new team",
    params: z.object({}),
    body: z.object({ name: z.string(), color: z.string() }),
    response: z.object({ item: teamWithStatsSchema })
});

export const getTeamDetailRoute = defineRoute({
    method: "GET",
    path: "/api/teams/:id",
    description: "Get team detail with projects",
    params: z.object({ id: z.string() }),
    response: z.object({
        item: z.object({
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
        })
    })
});

export const updateTeamRoute = defineRoute({
    method: "PUT",
    path: "/api/teams/:id",
    description: "Update a team",
    params: z.object({ id: z.string() }),
    body: z.object({ name: z.string().optional(), color: z.string().optional() }),
    response: z.object({ item: teamWithStatsSchema })
});

export const setTeamProjectsRoute = defineRoute({
    method: "PUT",
    path: "/api/teams/:id/projects",
    description: "Set team project assignments",
    params: z.object({ id: z.string() }),
    body: z.object({ projectIds: z.array(z.string()) })
});

export const deleteTeamRoute = defineRoute({
    method: "DELETE",
    path: "/api/teams/:id",
    description: "Delete a team",
    params: z.object({ id: z.string() })
});
