import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

export const exportAllSbomRoute = defineRoute({
    method: "GET",
    path: "/api/sbom",
    description: "Export aggregate SBOM for all projects",
    params: z.object({}),
    querystring: z.object({
        format: z.enum(["cyclonedx", "spdx"]).default("cyclonedx")
    })
});

export const exportProjectSbomRoute = defineRoute({
    method: "GET",
    path: "/api/sbom/:projectId",
    description: "Export SBOM for a specific project",
    params: z.object({ projectId: z.string() }),
    querystring: z.object({
        format: z.enum(["cyclonedx", "spdx"]).default("cyclonedx")
    })
});
