import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";

const securitySettingSchema = z.object({
    id: z.string(),
    packageManager: z.string(),
    configFile: z.string(),
    fieldName: z.string(),
    expectedValue: z.string(),
    enabled: z.boolean()
});

const configErrorSchema = z
    .object({
        type: z.enum(["json", "schema"]),
        message: z.string()
    })
    .optional();

export const listSecuritySettingsRoute = defineRoute({
    method: "GET",
    path: "/api/settings/security",
    description: "List all security settings",
    params: z.object({}),
    response: z.object({
        items: z.array(securitySettingSchema),
        total: z.number(),
        configSource: z.enum(["db", "file", "error"]),
        fileManagedPms: z.array(z.string()),
        configError: configErrorSchema
    })
});

export const createSecuritySettingRoute = defineRoute({
    method: "POST",
    path: "/api/settings/security",
    description: "Create a security setting",
    params: z.object({}),
    body: z.object({
        packageManager: z.string(),
        fieldName: z.string(),
        expectedValue: z.string()
    }),
    response: z.object({ item: securitySettingSchema })
});

export const updateSecuritySettingRoute = defineRoute({
    method: "PUT",
    path: "/api/settings/security/:id",
    description: "Update a security setting's expected value",
    params: z.object({ id: z.string() }),
    body: z.object({ expectedValue: z.string() }),
    response: z.object({ item: securitySettingSchema })
});

export const toggleSecuritySettingRoute = defineRoute({
    method: "PATCH",
    path: "/api/settings/security/:id/toggle",
    description: "Toggle a security setting enabled/disabled",
    params: z.object({ id: z.string() }),
    response: z.object({ item: securitySettingSchema })
});

export const resetSecuritySettingsRoute = defineRoute({
    method: "POST",
    path: "/api/settings/security/reset",
    description: "Reset all security settings for a package manager to registry defaults",
    params: z.object({}),
    body: z.object({ packageManager: z.string() }),
    response: z.object({ items: z.array(securitySettingSchema), total: z.number() })
});
