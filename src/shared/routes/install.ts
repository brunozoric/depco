import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    installProjectResponseSchema,
    getInstallOptionsResponseSchema
} from "../responses/install.js";

export const installProjectRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/install",
    description: "Run package manager install for a project",
    params: z.object({ id: z.string() }),
    body: z.object({ flags: z.array(z.string()).optional().default([]) }),
    response: installProjectResponseSchema
});

export const getInstallOptionsRoute = defineRoute({
    method: "GET",
    path: "/api/install-options/:packageManager",
    description: "Get available install flags for a package manager",
    params: z.object({ packageManager: z.string() }),
    response: getInstallOptionsResponseSchema
});
