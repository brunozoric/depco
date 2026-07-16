import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const installFlagItemSchema = z.object({
    flag: z.string(),
    label: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    defaultEnabled: z.boolean(),
    isFileManaged: z.boolean()
});

const pmGeneralSettingsSchema = z.object({
    registryUrl: z.string().nullable(),
    upgradeStrategy: z.string().nullable()
});

const pmConfigItemSchema = z.object({
    packageManager: z.string(),
    installFlags: z.array(installFlagItemSchema),
    general: pmGeneralSettingsSchema
});

const configErrorSchema = z
    .object({
        type: z.enum(["json", "schema"]),
        message: z.string()
    })
    .optional();

export const listPmSettingsRoute = defineRoute({
    method: "GET",
    path: "/api/settings/pm",
    description: "List per-PM install flags and general settings",
    params: z.object({}),
    response: z.object({
        items: z.array(pmConfigItemSchema),
        configSource: z.enum(["db", "file", "error"]),
        fileManagedPms: z.array(z.string()),
        configError: configErrorSchema
    })
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
    response: z.object({
        item: pmConfigItemSchema
    })
});
