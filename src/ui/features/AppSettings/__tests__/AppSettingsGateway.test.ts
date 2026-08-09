import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { listAppSettingsRoute, upsertAppSettingRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { AppSettingsGateway } from "../abstractions/AppSettingsGateway.js";
import { AppSettingsGateway as AppSettingsGatewayRegistration } from "../AppSettingsGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("AppSettingsGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): AppSettingsGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(AppSettingsGatewayRegistration);

        return container.resolve(AppSettingsGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("list()", () => {
        it("should call listAppSettingsRoute with correct args and return mapped result", async () => {
            mockResult = {
                items: [
                    { key: "theme", value: "dark" },
                    { key: "language", value: "en" }
                ],
                configSource: "db",
                fileManaged: ["theme", "language"]
            };

            const gateway = createGateway();
            const result = await gateway.list();

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(listAppSettingsRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual({
                settings: [
                    { key: "theme", value: "dark" },
                    { key: "language", value: "en" }
                ],
                configSource: "db",
                fileManaged: ["theme", "language"]
            });
        });

        it("should include configError when present in response", async () => {
            mockResult = {
                items: [],
                configSource: "error",
                fileManaged: [],
                configError: { type: "json", message: "Invalid JSON" }
            };

            const gateway = createGateway();
            const result = await gateway.list();

            expect(result.configError).toEqual({
                type: "json",
                message: "Invalid JSON"
            });
        });

        it("should omit configError when not present in response", async () => {
            mockResult = {
                items: [],
                configSource: "file",
                fileManaged: []
            };

            const gateway = createGateway();
            const result = await gateway.list();

            expect(result.configError).toBeUndefined();
            expect("configError" in result).toBe(false);
        });
    });

    describe("upsert()", () => {
        it("should call upsertAppSettingRoute with correct params and body and return the item", async () => {
            mockResult = {
                item: { key: "theme", value: "light" }
            };

            const gateway = createGateway();
            const result = await gateway.upsert("theme", "light");

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(upsertAppSettingRoute);
            expect(calls[0]!.args).toEqual({
                params: { key: "theme" },
                body: { value: "light" }
            });
            expect(result).toEqual({ key: "theme", value: "light" });
        });
    });
});
