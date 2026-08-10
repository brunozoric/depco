import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import { listPmSettingsRoute, updatePmConfigRoute } from "#shared/routes/index.js";
import type { PackageManagerId } from "#shared/security/index.js";
import { INSTALL_FLAG_REGISTRY } from "#shared/install/index.js";
import { FileConfigService } from "#api/services/FileConfig/index.js";

interface InstallFlagItemResponse {
    flag: string;
    label: string;
    description: string;
    enabled: boolean;
    defaultEnabled: boolean;
    isFileManaged: boolean;
}

interface PmGeneralSettingsResponse {
    registryUrl: string | null;
    upgradeStrategy: string | null;
}

interface PmConfigItemResponse {
    packageManager: string;
    installFlags: InstallFlagItemResponse[];
    general: PmGeneralSettingsResponse;
}

const ALL_PACKAGE_MANAGERS: PackageManagerId[] = ["yarn", "npm", "pnpm", "bun"];

function buildDefaultPmItems(): PmConfigItemResponse[] {
    return ALL_PACKAGE_MANAGERS.map(pm => ({
        packageManager: pm,
        installFlags: INSTALL_FLAG_REGISTRY[pm].map(flag => ({
            flag: flag.flag,
            label: flag.label,
            description: flag.description,
            enabled: flag.defaultEnabled,
            defaultEnabled: flag.defaultEnabled,
            isFileManaged: false
        })),
        general: { registryUrl: null, upgradeStrategy: null }
    }));
}

export function registerPmConfigRoutes(app: FastifyInstance, container: Container): void {
    registerRoute(app, listPmSettingsRoute, {}, async (_request, reply) => {
        const fileConfigService = container.resolve(FileConfigService);
        const fileConfigResult = await fileConfigService.readGlobalConfig();

        if (fileConfigResult.error) {
            reply.send({
                items: buildDefaultPmItems(),
                configSource: "error" as const,
                fileManagedPms: [],
                configError: fileConfigResult.error
            });
            return;
        }

        const allPmSettings = fileConfigResult.config?.pmSettings;
        const fileManagedPms = allPmSettings ? Object.keys(allPmSettings) : [];
        const configSource = fileManagedPms.length > 0 ? ("file" as const) : ("db" as const);

        const items: PmConfigItemResponse[] = ALL_PACKAGE_MANAGERS.map(pm => {
            const fileConfig = allPmSettings?.[pm];
            const registry = INSTALL_FLAG_REGISTRY[pm];
            const isManaged = fileManagedPms.includes(pm);

            const installFlags: InstallFlagItemResponse[] = registry.map(flag => {
                const fileValue = fileConfig?.installFlags?.[flag.flag];
                return {
                    flag: flag.flag,
                    label: flag.label,
                    description: flag.description,
                    enabled: fileValue ?? flag.defaultEnabled,
                    defaultEnabled: flag.defaultEnabled,
                    isFileManaged: isManaged && fileValue !== undefined
                };
            });

            return {
                packageManager: pm,
                installFlags,
                general: {
                    registryUrl: fileConfig?.registryUrl ?? null,
                    upgradeStrategy: fileConfig?.upgradeStrategy ?? null
                }
            };
        });

        reply.send({ items, configSource, fileManagedPms });
    });

    registerRoute(
        app,
        updatePmConfigRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { pm } = request.params;
            const fileConfigService = container.resolve(FileConfigService);

            const settings: FileConfigService.PmSettings = {};
            if (request.body.installFlags !== undefined) {
                settings.installFlags = request.body.installFlags;
            }
            if (request.body.registryUrl !== undefined) {
                // Empty string means "clear it" — convert to undefined so
                // writeGlobalPmSettings omits the key from the file entirely,
                // rather than persisting an invalid `registryUrl: ""`.
                settings.registryUrl =
                    request.body.registryUrl === "" ? undefined : request.body.registryUrl;
            }
            if (request.body.upgradeStrategy !== undefined) {
                settings.upgradeStrategy =
                    request.body.upgradeStrategy === "" ? undefined : request.body.upgradeStrategy;
            }

            await fileConfigService.writeGlobalPmSettings(pm, settings);

            const fileConfigResult = await fileConfigService.readGlobalConfig();
            const allPmSettings = fileConfigResult.config?.pmSettings;
            const registry = INSTALL_FLAG_REGISTRY[pm];
            const fileConfig = allPmSettings?.[pm];

            const installFlags: InstallFlagItemResponse[] = registry.map(flag => {
                const fileValue = fileConfig?.installFlags?.[flag.flag];
                return {
                    flag: flag.flag,
                    label: flag.label,
                    description: flag.description,
                    enabled: fileValue ?? flag.defaultEnabled,
                    defaultEnabled: flag.defaultEnabled,
                    isFileManaged: fileValue !== undefined
                };
            });

            const item: PmConfigItemResponse = {
                packageManager: pm,
                installFlags,
                general: {
                    registryUrl: fileConfig?.registryUrl ?? null,
                    upgradeStrategy: fileConfig?.upgradeStrategy ?? null
                }
            };

            sendOne({ reply: reply, data: item });
        }
    );
}
