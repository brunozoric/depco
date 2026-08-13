import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    listTeamsResponseSchema,
    createTeamResponseSchema,
    getTeamDetailResponseSchema,
    updateTeamResponseSchema
} from "../responses/teams.js";

export const listTeamsRoute = defineRoute({
    method: "GET",
    path: "/api/teams",
    description: "List all teams with aggregate stats",
    params: z.object({}),
    querystring: z.object({
        page: z.coerce.number().int().positive().optional(),
        pageSize: z.coerce.number().int().positive().max(200).optional()
    }),
    response: listTeamsResponseSchema
});

export const createTeamRoute = defineRoute({
    method: "POST",
    path: "/api/teams",
    description: "Create a new team",
    params: z.object({}),
    body: z.object({ name: z.string(), color: z.string() }),
    response: createTeamResponseSchema
});

export const getTeamDetailRoute = defineRoute({
    method: "GET",
    path: "/api/teams/:id",
    description: "Get team detail with projects",
    params: z.object({ id: z.string() }),
    response: getTeamDetailResponseSchema
});

export const updateTeamRoute = defineRoute({
    method: "PUT",
    path: "/api/teams/:id",
    description: "Update a team",
    params: z.object({ id: z.string() }),
    body: z.object({ name: z.string().optional(), color: z.string().optional() }),
    response: updateTeamResponseSchema
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
