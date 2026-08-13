import { z } from "zod";

export const appSettingSchema = z.object({
    key: z.string(),
    value: z.string()
});

export const configErrorSchema = z
    .object({
        type: z.enum(["json", "schema"]),
        message: z.string()
    })
    .optional();

export const listAppSettingsResponseSchema = z.object({
    items: z.array(appSettingSchema),
    total: z.number(),
    configSource: z.enum(["db", "file", "error"]),
    fileManaged: z.array(z.string()),
    configError: configErrorSchema
});

export const upsertAppSettingResponseSchema = z.object({
    item: appSettingSchema
});
