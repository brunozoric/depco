import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    listSecuritySettingsResponseSchema,
    createSecuritySettingResponseSchema,
    updateSecuritySettingResponseSchema,
    toggleSecuritySettingResponseSchema,
    resetSecuritySettingsResponseSchema
} from "../responses/settings.js";

export const listSecuritySettingsRoute = defineRoute({
    method: "GET",
    path: "/api/settings/security",
    description: "List all security settings",
    params: z.object({}),
    response: listSecuritySettingsResponseSchema
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
    response: createSecuritySettingResponseSchema
});

export const updateSecuritySettingRoute = defineRoute({
    method: "PUT",
    path: "/api/settings/security/:id",
    description: "Update a security setting's expected value",
    params: z.object({ id: z.string() }),
    body: z.object({ expectedValue: z.string() }),
    response: updateSecuritySettingResponseSchema
});

export const toggleSecuritySettingRoute = defineRoute({
    method: "PATCH",
    path: "/api/settings/security/:id/toggle",
    description: "Toggle a security setting enabled/disabled",
    params: z.object({ id: z.string() }),
    response: toggleSecuritySettingResponseSchema
});

export const resetSecuritySettingsRoute = defineRoute({
    method: "POST",
    path: "/api/settings/security/reset",
    description: "Reset all security settings for a package manager to registry defaults",
    params: z.object({}),
    body: z.object({ packageManager: z.string() }),
    response: resetSecuritySettingsResponseSchema
});
