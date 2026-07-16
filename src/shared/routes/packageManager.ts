import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

export const getPackageManagerRoute = defineRoute({
    method: "GET",
    path: "/api/projects/:id/package-manager",
    description: "Get the project's current package manager version",
    params: z.object({ id: z.string() }),
    response: z.object({ item: z.object({ version: z.string() }) })
});

export const updatePackageManagerRoute = defineRoute({
    method: "POST",
    path: "/api/projects/:id/package-manager/update",
    description: "Enqueue a package manager version update job",
    params: z.object({ id: z.string() }),
    body: z.object({ version: z.string().min(1) }),
    response: z.object({ item: z.object({ jobId: z.string() }) })
});
