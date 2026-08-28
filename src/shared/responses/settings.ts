import { z } from "zod";

export const securitySettingSchema = z.object({
    id: z.string(),
    packageManager: z.string(),
    configFile: z.string(),
    fieldName: z.string(),
    expectedValue: z.string(),
    enabled: z.boolean()
});

export const securityConfigErrorSchema = z
    .object({
        type: z.enum(["json", "schema"]),
        message: z.string()
    })
    .optional();

export const listSecuritySettingsResponseSchema = z.object({
    items: z.array(securitySettingSchema),
    total: z.number(),
    configSource: z.enum(["db", "file", "error"]),
    fileManagedPms: z.array(z.string()),
    configError: securityConfigErrorSchema
});

export const createSecuritySettingResponseSchema = z.object({ item: securitySettingSchema });

export const updateSecuritySettingResponseSchema = z.object({ item: securitySettingSchema });

export const toggleSecuritySettingResponseSchema = z.object({ item: securitySettingSchema });

export const resetSecuritySettingsResponseSchema = z.object({
    items: z.array(securitySettingSchema),
    total: z.number()
});
