import { describe, it, expect, beforeEach } from "vitest";
import { createContainer } from "#shared/index.js";
import {
    loginRoute,
    verifyCodeRoute,
    magicLinkRoute,
    verifyMagicLinkRoute,
    getMeRoute,
    logoutRoute
} from "#shared/routes/index.js";
import { HTTPClient } from "../../../infrastructure/HttpClient/abstractions/HTTPClient.js";
import { AuthGateway } from "../abstractions/AuthGateway.js";
import { AuthGateway as AuthGatewayRegistration } from "../AuthGateway.js";

interface RecordedCall {
    route: unknown;
    args: unknown;
}

describe("AuthGateway", () => {
    let calls: RecordedCall[];
    let mockResult: unknown;

    function createGateway(): AuthGateway.Interface {
        const container = createContainer();

        container.registerInstance(HTTPClient, {
            request: async <T>(route: unknown, args: unknown): Promise<T> => {
                calls.push({ route, args });
                return mockResult as T;
            }
        });
        container.register(AuthGatewayRegistration);

        return container.resolve(AuthGateway);
    }

    beforeEach(() => {
        calls = [];
        mockResult = undefined;
    });

    it("login() calls loginRoute with email and password", async () => {
        const gateway = createGateway();
        await gateway.login({ email: "user@example.com", password: "secret" });

        expect(calls).toHaveLength(1);
        expect(calls[0]!.route).toBe(loginRoute);
        expect(calls[0]!.args).toEqual({
            params: {},
            body: { email: "user@example.com", password: "secret" }
        });
    });

    it("verifyCode() calls verifyCodeRoute and returns the unwrapped item", async () => {
        mockResult = {
            item: {
                token: "token-1",
                user: {
                    id: "u1",
                    email: "user@example.com",
                    displayName: "User",
                    permission: "full",
                    isActive: true,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        };

        const gateway = createGateway();
        const result = await gateway.verifyCode({ email: "user@example.com", code: "123456" });

        expect(calls[0]!.route).toBe(verifyCodeRoute);
        expect(calls[0]!.args).toEqual({
            params: {},
            body: { email: "user@example.com", code: "123456" }
        });
        expect(result).toEqual((mockResult as { item: unknown }).item);
    });

    it("requestMagicLink() calls magicLinkRoute with email", async () => {
        const gateway = createGateway();
        await gateway.requestMagicLink({ email: "user@example.com" });

        expect(calls[0]!.route).toBe(magicLinkRoute);
        expect(calls[0]!.args).toEqual({ params: {}, body: { email: "user@example.com" } });
    });

    it("verifyMagicLink() calls verifyMagicLinkRoute and returns the unwrapped item", async () => {
        mockResult = {
            item: {
                token: "token-2",
                user: {
                    id: "u1",
                    email: "user@example.com",
                    displayName: "User",
                    permission: "read-only",
                    isActive: true,
                    createdAt: 1,
                    updatedAt: 1
                }
            }
        };

        const gateway = createGateway();
        const result = await gateway.verifyMagicLink({
            token: "magic-token",
            email: "user@example.com"
        });

        expect(calls[0]!.route).toBe(verifyMagicLinkRoute);
        expect(calls[0]!.args).toEqual({
            params: {},
            body: { token: "magic-token", email: "user@example.com" }
        });
        expect(result).toEqual((mockResult as { item: unknown }).item);
    });

    it("logout() calls logoutRoute", async () => {
        const gateway = createGateway();
        await gateway.logout();

        expect(calls[0]!.route).toBe(logoutRoute);
        expect(calls[0]!.args).toEqual({ params: {} });
    });

    it("getMe() calls getMeRoute and returns the unwrapped item", async () => {
        mockResult = {
            item: {
                id: "u1",
                email: "user@example.com",
                displayName: "User",
                permission: "full",
                isActive: true,
                createdAt: 1,
                updatedAt: 1
            }
        };

        const gateway = createGateway();
        const result = await gateway.getMe();

        expect(calls[0]!.route).toBe(getMeRoute);
        expect(calls[0]!.args).toEqual({ params: {} });
        expect(result).toEqual((mockResult as { item: unknown }).item);
    });
});
