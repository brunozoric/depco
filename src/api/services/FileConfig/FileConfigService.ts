import { join } from "path";
import { z } from "zod";
import { JsonFileTool } from "@webiny/stdlib/node";
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";
import { INSTALL_FLAG_REGISTRY } from "#shared/install/index.js";
import { FileConfigService as Abstraction } from "./abstractions/FileConfigService.js";
import type {
    IProjectFileConfig,
    IFileSettings,
    IFileAllPmSettings,
    IFilePmSettings,
    IFileConfigResult,
    IFileSettingsResult
} from "./abstractions/FileConfigService.js";

const CONFIG_FILENAME = ".dependency-upgrader.json";

const fileStepHookSchema = z.object({
    position: z.string(),
    name: z.string(),
    command: z.string(),
    executionType: z.enum(["command", "script", "package-script"]),
    required: z.boolean()
});

const logLevelEnum = z.enum(["trace", "debug", "info", "warn", "error", "fatal"]);

const fileSettingsSchema = z.object({
    branchTemplate: z.string().optional(),
    commitTemplate: z.string().optional(),
    logLevel: logLevelEnum.optional(),
    consoleLogLevel: logLevelEnum.optional(),
    fileLogLevel: logLevelEnum.optional()
});

const filePmSettingsSchema = z
    .record(
        z.string(),
        z.object({
            security: z.record(z.string(), z.string()).optional(),
            installFlags: z.record(z.string(), z.boolean()).optional(),
            registryUrl: z.string().url().optional(),
            upgradeStrategy: z.enum(["caret", "tilde", "exact", "latest"]).optional()
        })
    )
    .optional()
    .superRefine((value, ctx) => {
        if (!value) {
            return;
        }
        const validPms = ["yarn", "npm", "pnpm", "bun"];
        for (const [pm, pmConfig] of Object.entries(value)) {
            if (!validPms.includes(pm)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `Unknown package manager: ${pm}`,
                    path: [pm]
                });
                continue;
            }

            // Validate security fields
            if (pmConfig.security) {
                const registry = SECURITY_FIELD_REGISTRY[pm as PackageManagerId];
                for (const [fieldName, fieldValue] of Object.entries(pmConfig.security)) {
                    const fieldDef = registry?.find(f => f.fieldName === fieldName);
                    if (!fieldDef) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Unknown security field "${fieldName}" for ${pm}`,
                            path: [pm, "security", fieldName]
                        });
                        continue;
                    }
                    const validation = fieldDef.expectedValueSchema.safeParse(fieldValue);
                    if (!validation.success) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message:
                                validation.error.issues[0]?.message ??
                                `Invalid value for ${fieldName}`,
                            path: [pm, "security", fieldName]
                        });
                    }
                }
            }

            // Validate install flags
            if (pmConfig.installFlags) {
                const flagRegistry = INSTALL_FLAG_REGISTRY[pm as PackageManagerId];
                const knownFlags = new Set(flagRegistry.map(f => f.flag));
                for (const flagKey of Object.keys(pmConfig.installFlags)) {
                    if (!knownFlags.has(flagKey)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: `Unknown install flag "${flagKey}" for ${pm}`,
                            path: [pm, "installFlags", flagKey]
                        });
                    }
                }
            }
        }
    });

const projectFileConfigSchema = z
    .object({
        stepHooks: z.array(fileStepHookSchema).optional(),
        settings: fileSettingsSchema.optional(),
        pmSettings: filePmSettingsSchema
    })
    .strict();

// zod's `.optional()` infers `key?: T | undefined`, which is stricter than a
// hand-written `key?: T` under `exactOptionalPropertyTypes`. These helpers
// rebuild the parsed value, assigning a key only when it is actually present,
// so the result satisfies the narrower interface.
function toFileSettings(parsed: z.infer<typeof fileSettingsSchema>): IFileSettings {
    const settings: IFileSettings = {};
    if (parsed.branchTemplate !== undefined) {
        settings.branchTemplate = parsed.branchTemplate;
    }
    if (parsed.commitTemplate !== undefined) {
        settings.commitTemplate = parsed.commitTemplate;
    }
    if (parsed.logLevel !== undefined) {
        settings.logLevel = parsed.logLevel;
    }
    if (parsed.consoleLogLevel !== undefined) {
        settings.consoleLogLevel = parsed.consoleLogLevel;
    }
    if (parsed.fileLogLevel !== undefined) {
        settings.fileLogLevel = parsed.fileLogLevel;
    }
    return settings;
}

function toFilePmSettings(
    parsed: NonNullable<z.infer<typeof filePmSettingsSchema>>
): IFileAllPmSettings {
    const result: IFileAllPmSettings = {};
    for (const [pm, pmConfig] of Object.entries(parsed)) {
        const settings: IFilePmSettings = {};
        if (pmConfig.security !== undefined) {
            settings.security = pmConfig.security;
        }
        if (pmConfig.installFlags !== undefined) {
            settings.installFlags = pmConfig.installFlags;
        }
        if (pmConfig.registryUrl !== undefined) {
            settings.registryUrl = pmConfig.registryUrl;
        }
        if (pmConfig.upgradeStrategy !== undefined) {
            settings.upgradeStrategy = pmConfig.upgradeStrategy;
        }
        result[pm] = settings;
    }
    return result;
}

function toFileConfig(parsed: z.infer<typeof projectFileConfigSchema>): IProjectFileConfig {
    const config: IProjectFileConfig = {};
    if (parsed.stepHooks !== undefined) {
        config.stepHooks = parsed.stepHooks;
    }
    if (parsed.settings !== undefined) {
        config.settings = toFileSettings(parsed.settings);
    }
    if (parsed.pmSettings !== undefined) {
        config.pmSettings = toFilePmSettings(parsed.pmSettings);
    }
    return config;
}

class FileConfigServiceImpl implements Abstraction.Interface {
    private cachedResult: IFileConfigResult | null = null;
    private cachedAt = 0;
    private static readonly CACHE_TTL_MS = 10_000;

    public constructor(private readonly jsonFileTool: JsonFileTool.Interface) {}

    public async readConfig(projectPath: string): Promise<IProjectFileConfig | null> {
        const result = this.jsonFileTool.readJson<z.infer<typeof projectFileConfigSchema>>(
            join(projectPath, CONFIG_FILENAME),
            { schema: projectFileConfigSchema }
        );
        if (result === null) {
            return null;
        }
        return toFileConfig(result);
    }

    public async readGlobalConfig(): Promise<IFileConfigResult> {
        const now = Date.now();
        if (
            this.cachedResult !== null &&
            now - this.cachedAt < FileConfigServiceImpl.CACHE_TTL_MS
        ) {
            return this.cachedResult;
        }

        try {
            const result = this.jsonFileTool.readJson<z.infer<typeof projectFileConfigSchema>>(
                join(process.cwd(), CONFIG_FILENAME),
                { schema: projectFileConfigSchema }
            );
            const parsedResult: IFileConfigResult =
                result === null ? { config: null } : { config: toFileConfig(result) };
            this.cachedResult = parsedResult;
            this.cachedAt = now;
            return parsedResult;
        } catch (error: unknown) {
            if (error instanceof SyntaxError) {
                const errorResult: IFileConfigResult = {
                    config: null,
                    error: { type: "json", message: error.message }
                };
                this.cachedResult = errorResult;
                this.cachedAt = now;
                return errorResult;
            }
            if (error instanceof z.ZodError) {
                const errorResult: IFileConfigResult = {
                    config: null,
                    error: {
                        type: "schema",
                        message: error.issues[0]?.message ?? "Invalid config"
                    }
                };
                this.cachedResult = errorResult;
                this.cachedAt = now;
                return errorResult;
            }
            throw error;
        }
    }

    public async readGlobalSettings(): Promise<IFileSettingsResult> {
        const result = await this.readGlobalConfig();
        if (result.error) {
            return { settings: null, error: result.error };
        }
        return { settings: result.config?.settings ?? null };
    }

    public async writeGlobalPmSettings(
        pm: PackageManagerId,
        settings: IFilePmSettings
    ): Promise<void> {
        const configPath = join(process.cwd(), CONFIG_FILENAME);
        const existing = this.jsonFileTool.readJson<Record<string, unknown>>(configPath) ?? {};
        const existingPmSettings = (existing["pmSettings"] as Record<string, unknown>) ?? {};
        const existingPm = (existingPmSettings[pm] as Record<string, unknown>) ?? {};

        existing["pmSettings"] = {
            ...existingPmSettings,
            [pm]: { ...existingPm, ...settings }
        };

        this.jsonFileTool.writeJson(configPath, existing);
        this.cachedResult = null;
        this.cachedAt = 0;
    }
}

export const FileConfigService = Abstraction.createImplementation({
    implementation: FileConfigServiceImpl,
    dependencies: [JsonFileTool]
});
