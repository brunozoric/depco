import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import { listLogsRoute, deleteLogsRoute } from "#shared/routes/index.js";
import { HTTPClient } from "../../../httpClient/abstractions/HTTPClient.js";
import { AppLogsGateway } from "../abstractions/AppLogsGateway.js";
import { AppLogsGateway as AppLogsGatewayRegistration } from "../AppLogsGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("AppLogsGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): AppLogsGateway.Interface {
        const container = createContainer();
        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(AppLogsGatewayRegistration);
        return container.resolve(AppLogsGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    describe("list", () => {
        it("should send empty query when filters are empty", async () => {
            mockResult = { items: [], total: 0 };
            const gateway = createGateway();

            const result = await gateway.list({});

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(listLogsRoute);
            expect(calls[0]!.args).toEqual({ params: {}, query: {} });
            expect(result).toEqual({ items: [], total: 0 });
        });

        it("should send all filter values as query params", async () => {
            mockResult = { items: [], total: 0 };
            const gateway = createGateway();

            await gateway.list({
                level: "error",
                source: "api",
                projectId: "proj-1",
                from: "2024-01-01",
                to: "2024-12-31"
            });

            expect(calls[0]!.args).toEqual({
                params: {},
                query: {
                    level: "error",
                    source: "api",
                    projectId: "proj-1",
                    from: "2024-01-01",
                    to: "2024-12-31"
                }
            });
        });

        it("should send limit and offset as query params", async () => {
            mockResult = { items: [], total: 0 };
            const gateway = createGateway();

            await gateway.list({}, 25, 50);

            expect(calls[0]!.args).toEqual({
                params: {},
                query: { limit: "25", offset: "50" }
            });
        });

        it("should send only provided filters as query params", async () => {
            mockResult = { items: [], total: 0 };
            const gateway = createGateway();

            await gateway.list({ level: "warn", projectId: "proj-2" });

            expect(calls[0]!.args).toEqual({
                params: {},
                query: { level: "warn", projectId: "proj-2" }
            });
        });
    });

    describe("deleteFiltered", () => {
        it("should send empty body when filters are empty", async () => {
            mockResult = { deleted: 0 };
            const gateway = createGateway();

            await gateway.deleteFiltered({});

            expect(calls).toHaveLength(1);
            expect(calls[0]!.route).toBe(deleteLogsRoute);
            expect(calls[0]!.args).toEqual({ params: {}, body: {} });
        });

        it("should send all filter values in the body", async () => {
            mockResult = { deleted: 5 };
            const gateway = createGateway();

            await gateway.deleteFiltered({
                level: "error",
                source: "api",
                projectId: "proj-1",
                from: "2024-01-01",
                to: "2024-12-31"
            });

            expect(calls[0]!.args).toEqual({
                params: {},
                body: {
                    level: "error",
                    source: "api",
                    projectId: "proj-1",
                    from: "2024-01-01",
                    to: "2024-12-31"
                }
            });
        });

        it("should return the deleted count", async () => {
            mockResult = { deleted: 42 };
            const gateway = createGateway();

            const result = await gateway.deleteFiltered({ level: "debug" });

            expect(result).toBe(42);
        });
    });
});
