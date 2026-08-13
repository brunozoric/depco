import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    listPmSettingsResponseSchema,
    updatePmConfigResponseSchema
} from "../responses/pmSettings.js";

export const listPmSettingsRoute = defineRoute({
    method: "GET",
    path: "/api/settings/pm",
    description: "List per-PM install flags and general settings",
    params: z.object({}),
    response: listPmSettingsResponseSchema
});

const updatePmConfigBodySchema = z.object({
    installFlags: z.record(z.string(), z.boolean()).optional(),
    registryUrl: z.union([z.string().url(), z.literal("")]).optional(),
    upgradeStrategy: z
        .union([z.enum(["caret", "tilde", "exact", "latest"]), z.literal("")])
        .optional()
});

export const updatePmConfigRoute = defineRoute({
    method: "PUT",
    path: "/api/settings/pm/:pm",
    description: "Update PM config in .dependency-upgrader.json",
    params: z.object({
        pm: z.enum(["yarn", "npm", "pnpm", "bun"])
    }),
    body: updatePmConfigBodySchema,
    response: updatePmConfigResponseSchema
});
