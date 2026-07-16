import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../../httpClient/abstractions/HTTPClient.js";
import { HTTPClientFeature } from "../../../../httpClient/feature.js";
import { AppSettingsFeature } from "../../../../features/appSettings/feature.js";
import { AppSettingsUseCasesFeature } from "../feature.js";
import { LoadAppSettingsUseCase } from "../abstractions/LoadAppSettingsUseCase.js";
import { UpsertAppSettingUseCase } from "../abstractions/UpsertAppSettingUseCase.js";
import { AppSettingsRepository } from "../../../../features/appSettings/abstractions/AppSettingsRepository.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

interface TestContext {
    loadAppSettingsUseCase: LoadAppSettingsUseCase.Interface;
    upsertAppSettingUseCase: UpsertAppSettingUseCase.Interface;
    appSettingsRepository: AppSettingsRepository.Interface;
}

describe("app settings use cases", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createContext(): TestContext {
        const container = createContainer();

        HTTPClientFeature.register(container);
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        AppSettingsFeature.register(container);
        AppSettingsUseCasesFeature.register(container);

        return {
            loadAppSettingsUseCase: container.resolve(LoadAppSettingsUseCase),
            upsertAppSettingUseCase: container.resolve(UpsertAppSettingUseCase),
            appSettingsRepository: container.resolve(AppSettingsRepository)
        };
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("LoadAppSettingsUseCase", () => {
        it("stores settings from gateway in the repository", async () => {
            mockResult = {
                items: [
                    { key: "branch_template", value: "upgrade/${PROJECT}" },
                    { key: "log_level", value: "warn" }
                ],
                total: 2,
                configSource: "db",
                fileManaged: []
            };
            const context = createContext();

            await context.loadAppSettingsUseCase.execute();

            expect(calls).toEqual([
                { route: listAppSettingsRoute, args: { params: {}, query: {} } }
            ]);
            expect(context.appSettingsRepository.getSettings()).toEqual([
                { key: "branch_template", value: "upgrade/${PROJECT}" },
                { key: "log_level", value: "warn" }
            ]);
        });

        it("stores configSource in the repository", async () => {
            mockResult = {
                items: [],
                total: 0,
                configSource: "file",
                fileManaged: []
            };
            const context = createContext();

            await context.loadAppSettingsUseCase.execute();

            expect(context.appSettingsRepository.getConfigSource()).toBe("file");
        });

        it("stores fileManaged in the repository", async () => {
            mockResult = {
                items: [],
                total: 0,
                configSource: "file",
                fileManaged: ["branch_template", "commit_template"]
            };
            const context = createContext();

            await context.loadAppSettingsUseCase.execute();

            expect(context.appSettingsRepository.getFileManaged()).toEqual([
                "branch_template",
                "commit_template"
            ]);
        });

        it("stores configError in the repository when present", async () => {
            mockResult = {
                items: [],
                total: 0,
                configSource: "error",
                fileManaged: [],
                configError: { type: "json", message: "Unexpected token" }
            };
            const context = createContext();

            await context.loadAppSettingsUseCase.execute();

            expect(context.appSettingsRepository.getConfigError()).toEqual({
                type: "json",
                message: "Unexpected token"
            });
        });

        it("stores null configError when not present in result", async () => {
            mockResult = {
                items: [],
                total: 0,
                configSource: "db",
                fileManaged: []
            };
            const context = createContext();

            await context.loadAppSettingsUseCase.execute();

            expect(context.appSettingsRepository.getConfigError()).toBeNull();
        });
    });

    describe("UpsertAppSettingUseCase", () => {
        it("calls gateway upsert and stores the result in the repository", async () => {
            mockResult = { item: { key: "log_level", value: "info" } };
            const context = createContext();

            await context.upsertAppSettingUseCase.execute("log_level", "info");

            expect(calls).toEqual([
                {
                    route: upsertAppSettingRoute,
                    args: { params: { key: "log_level" }, body: { value: "info" } }
                }
            ]);
            expect(context.appSettingsRepository.getSettings()).toEqual([
                { key: "log_level", value: "info" }
            ]);
        });

        it("updates existing setting in repository when key matches", async () => {
            mockResult = { item: { key: "log_level", value: "error" } };
            const context = createContext();
            context.appSettingsRepository.setSettings([
                { key: "log_level", value: "warn" },
                { key: "branch_template", value: "upgrade/${PROJECT}" }
            ]);

            await context.upsertAppSettingUseCase.execute("log_level", "error");

            expect(context.appSettingsRepository.getSettings()).toEqual([
                { key: "log_level", value: "error" },
                { key: "branch_template", value: "upgrade/${PROJECT}" }
            ]);
        });
    });
});
