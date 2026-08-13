import { z } from "zod";
import { defineRoute } from "#shared/routing/index.js";
import {
    listAppSettingsResponseSchema,
    upsertAppSettingResponseSchema
} from "../responses/appSettings.js";

export const listAppSettingsRoute = defineRoute({
    method: "GET",
    path: "/api/settings/app",
    description: "List all app settings",
    params: z.object({}),
    querystring: z.object({}),
    response: listAppSettingsResponseSchema
});

export const upsertAppSettingRoute = defineRoute({
    method: "PUT",
    path: "/api/settings/app/:key",
    description: "Create or update an app setting",
    params: z.object({ key: z.string() }),
    body: z.object({ value: z.string() }),
    response: upsertAppSettingResponseSchema
});
