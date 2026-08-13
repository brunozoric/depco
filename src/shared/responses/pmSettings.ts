import { z } from "zod";

export const installFlagItemSchema = z.object({
    flag: z.string(),
    label: z.string(),
    description: z.string(),
    enabled: z.boolean(),
    defaultEnabled: z.boolean(),
    isFileManaged: z.boolean()
});

export const pmGeneralSettingsSchema = z.object({
    registryUrl: z.string().nullable(),
    upgradeStrategy: z.string().nullable()
});

export const pmConfigItemSchema = z.object({
    packageManager: z.string(),
    installFlags: z.array(installFlagItemSchema),
    general: pmGeneralSettingsSchema
});

export const pmConfigErrorSchema = z
    .object({
        type: z.enum(["json", "schema"]),
        message: z.string()
    })
    .optional();

export const listPmSettingsResponseSchema = z.object({
    items: z.array(pmConfigItemSchema),
    configSource: z.enum(["db", "file", "error"]),
    fileManagedPms: z.array(z.string()),
    configError: pmConfigErrorSchema
});

export const updatePmConfigResponseSchema = z.object({
    item: pmConfigItemSchema
});
