import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { updatePmConfigRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { PmSettingsGateway as PmSettingsGatewayRegistration } from "../../../../features/Settings/PmSettingsGateway.js";
import { PmSettingsRepository } from "../../../../features/Settings/abstractions/PmSettingsRepository.js";
import { PmSettingsRepository as PmSettingsRepositoryRegistration } from "../../../../features/Settings/PmSettingsRepository.js";
import { SavePmConfigUseCase } from "../abstractions/SavePmConfigUseCase.js";
import { SavePmConfigUseCase as SavePmConfigUseCaseRegistration } from "../SavePmConfigUseCase.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    repository: PmSettingsRepository.Interface;
    useCase: SavePmConfigUseCase.Interface;
}

describe("SavePmConfigUseCase", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createContext(): TestContext {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(PmSettingsGatewayRegistration).inSingletonScope();
        container.register(PmSettingsRepositoryRegistration).inSingletonScope();
        container.register(SavePmConfigUseCaseRegistration);

        return {
            repository: container.resolve(PmSettingsRepository),
            useCase: container.resolve(SavePmConfigUseCase)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("calls gateway.updatePmConfig() and updates matching PM config in repository", async () => {
        const context = createContext();

        const yarnConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "yarn",
            installFlags: [
                {
                    flag: "--frozen-lockfile",
                    label: "Frozen lockfile",
                    description: "Do not update the lockfile",
                    enabled: true,
                    defaultEnabled: true,
                    isFileManaged: false
                }
            ],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        const npmConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "npm",
            installFlags: [],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        context.repository.setPmConfigs([yarnConfig, npmConfig]);

        const updatedYarnConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "yarn",
            installFlags: [
                {
                    flag: "--frozen-lockfile",
                    label: "Frozen lockfile",
                    description: "Do not update the lockfile",
                    enabled: false,
                    defaultEnabled: true,
                    isFileManaged: false
                }
            ],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        mockResult = { item: updatedYarnConfig };

        await context.useCase.execute("yarn", { installFlags: { "--frozen-lockfile": false } });

        expect(calls).toEqual([
            {
                route: updatePmConfigRoute,
                args: {
                    params: { pm: "yarn" },
                    body: { installFlags: { "--frozen-lockfile": false } }
                }
            }
        ]);

        const configs = context.repository.getPmConfigs();
        expect(configs).toEqual([updatedYarnConfig, npmConfig]);
    });

    it("does not modify configs for other package managers", async () => {
        const context = createContext();

        const yarnConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "yarn",
            installFlags: [],
            general: { registryUrl: "https://registry.yarn.example", upgradeStrategy: "caret" }
        };

        const npmConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "npm",
            installFlags: [],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        context.repository.setPmConfigs([yarnConfig, npmConfig]);

        const updatedNpmConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "npm",
            installFlags: [],
            general: { registryUrl: "https://registry.npmjs.org", upgradeStrategy: null }
        };

        mockResult = { item: updatedNpmConfig };

        await context.useCase.execute("npm", { registryUrl: "https://registry.npmjs.org" });

        const configs = context.repository.getPmConfigs();
        expect(configs[0]).toEqual(yarnConfig);
        expect(configs[1]).toEqual(updatedNpmConfig);
    });

    it("works with installFlags update body", async () => {
        const context = createContext();

        const pnpmConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "pnpm",
            installFlags: [
                {
                    flag: "--shamefully-hoist",
                    label: "Shamefully hoist",
                    description: "Hoist all dependencies",
                    enabled: false,
                    defaultEnabled: false,
                    isFileManaged: false
                }
            ],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        context.repository.setPmConfigs([pnpmConfig]);

        const updatedPnpmConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "pnpm",
            installFlags: [
                {
                    flag: "--shamefully-hoist",
                    label: "Shamefully hoist",
                    description: "Hoist all dependencies",
                    enabled: true,
                    defaultEnabled: false,
                    isFileManaged: false
                }
            ],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        mockResult = { item: updatedPnpmConfig };

        await context.useCase.execute("pnpm", { installFlags: { "--shamefully-hoist": true } });

        expect(calls).toEqual([
            {
                route: updatePmConfigRoute,
                args: {
                    params: { pm: "pnpm" },
                    body: { installFlags: { "--shamefully-hoist": true } }
                }
            }
        ]);

        expect(context.repository.getPmConfigs()).toEqual([updatedPnpmConfig]);
    });

    it("works with registryUrl update body", async () => {
        const context = createContext();

        const bunConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "bun",
            installFlags: [],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        context.repository.setPmConfigs([bunConfig]);

        const updatedBunConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "bun",
            installFlags: [],
            general: { registryUrl: "https://custom.registry.io", upgradeStrategy: null }
        };

        mockResult = { item: updatedBunConfig };

        await context.useCase.execute("bun", { registryUrl: "https://custom.registry.io" });

        expect(calls).toEqual([
            {
                route: updatePmConfigRoute,
                args: {
                    params: { pm: "bun" },
                    body: { registryUrl: "https://custom.registry.io" }
                }
            }
        ]);

        expect(context.repository.getPmConfigs()).toEqual([updatedBunConfig]);
    });

    it("works with upgradeStrategy update body", async () => {
        const context = createContext();

        const yarnConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "yarn",
            installFlags: [],
            general: { registryUrl: null, upgradeStrategy: null }
        };

        context.repository.setPmConfigs([yarnConfig]);

        const updatedYarnConfig: PmSettingsRepository.PmConfigItem = {
            packageManager: "yarn",
            installFlags: [],
            general: { registryUrl: null, upgradeStrategy: "tilde" }
        };

        mockResult = { item: updatedYarnConfig };

        await context.useCase.execute("yarn", { upgradeStrategy: "tilde" });

        expect(calls).toEqual([
            {
                route: updatePmConfigRoute,
                args: {
                    params: { pm: "yarn" },
                    body: { upgradeStrategy: "tilde" }
                }
            }
        ]);

        expect(context.repository.getPmConfigs()).toEqual([updatedYarnConfig]);
    });
});
