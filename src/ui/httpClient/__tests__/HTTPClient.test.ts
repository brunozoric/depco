import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { createContainer } from "#shared/index.js";
import { defineRoute } from "#shared/routing/index.js";
import { HTTPClient } from "../abstractions/HTTPClient.js";
import { HTTPClient as HTTPClientRegistration } from "../HTTPClient.js";
import { AuthRepository } from "../../features/Auth/abstractions/AuthRepository.js";

function createFakeAuthRepository(token: string | null = null): AuthRepository.Interface {
    return {
        token,
        currentUser: null,
        isAuthenticated: token !== null,
        setAuth: vi.fn(),
        clearAuth: vi.fn()
    } as unknown as AuthRepository.Interface;
}

describe("HTTPClient", () => {
    it("resolves from DI container", () => {
        const container = createContainer();
        container.registerInstance(AuthRepository, createFakeAuthRepository());
        container.register(HTTPClientRegistration);

        const client = container.resolve(HTTPClient);
        expect(client).toBeDefined();
        expect(typeof client.request).toBe("function");
    });

    it("mock implementation returns preset data via registerInstance", async () => {
        const container = createContainer();
        container.registerInstance(HTTPClient, {
            request: async <T>() => [{ id: "p1", name: "test" }] as T
        });

        const client = container.resolve(HTTPClient);
        const result = await client.request(
            {
                method: "GET",
                path: "/api/projects",
                description: "List projects",
                params: {} as never
            },
            { params: {} }
        );
        expect(result).toEqual([{ id: "p1", name: "test" }]);
    });
});

describe("HTTPClient#request", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function createClient(authRepository: AuthRepository.Interface = createFakeAuthRepository()) {
        const container = createContainer();
        container.registerInstance(AuthRepository, authRepository);
        container.register(HTTPClientRegistration);
        return container.resolve(HTTPClient);
    }

    const getRoute = defineRoute({
        method: "GET",
        path: "/api/projects/:id",
        description: "Get a single project",
        params: z.object({ id: z.string() }),
        response: z.object({ item: z.object({ id: z.string(), name: z.string() }) })
    });

    const listRoute = defineRoute({
        method: "GET",
        path: "/api/projects",
        description: "List projects",
        params: z.object({}),
        querystring: z.object({ status: z.string().optional() }),
        response: z.object({ items: z.array(z.string()) })
    });

    const postRoute = defineRoute({
        method: "POST",
        path: "/api/projects",
        description: "Create a project",
        params: z.object({}),
        body: z.object({ path: z.string() }),
        response: z.object({ item: z.object({ id: z.string() }) })
    });

    const deleteRoute = defineRoute({
        method: "DELETE",
        path: "/api/projects/:id",
        description: "Delete a project",
        params: z.object({ id: z.string() })
    });

    it("makes a GET request to the interpolated path", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ item: { id: "p1", name: "test" } }), { status: 200 })
            );
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient();
        const result = await client.request(getRoute, { params: { id: "p1" } });

        expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1", { method: "GET" });
        expect(result).toEqual({ item: { id: "p1", name: "test" } });
    });

    it("appends query params as a URLSearchParams string", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ items: ["a", "b"] }), { status: 200 })
            );
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient();
        const result = await client.request(listRoute, { params: {}, query: { status: "active" } });

        expect(fetchMock).toHaveBeenCalledWith("/api/projects?status=active", { method: "GET" });
        expect(result).toEqual({ items: ["a", "b"] });
    });

    it("makes a POST request with a JSON body and Content-Type header", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ item: { id: "new" } }), { status: 201 })
            );
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient();
        const result = await client.request(postRoute, {
            params: {},
            body: { path: "/tmp/project" }
        });

        expect(fetchMock).toHaveBeenCalledWith("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: "/tmp/project" })
        });
        expect(result).toEqual({ item: { id: "new" } });
    });

    it("makes a DELETE request and returns undefined when there is no response schema", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient();
        const result = await client.request(deleteRoute, { params: { id: "p1" } });

        expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1", { method: "DELETE" });
        expect(result).toBeUndefined();
    });

    it("parses the response through the route's Zod schema", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ item: { id: "p1", name: "test" } }), { status: 200 })
            );
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient();
        const result = await client.request(getRoute, { params: { id: "p1" } });

        expect(result.item.id).toBe("p1");
        expect(result.item.name).toBe("test");
    });

    it("throws when the response is not ok", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient();
        await expect(client.request(getRoute, { params: { id: "p1" } })).rejects.toThrow(
            "GET /api/projects/p1 failed: 500"
        );
    });

    it("adds an Authorization header when a token is present", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ item: { id: "p1", name: "test" } }), { status: 200 })
            );
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient(createFakeAuthRepository("secret-token"));
        await client.request(getRoute, { params: { id: "p1" } });

        expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1", {
            method: "GET",
            headers: { Authorization: "Bearer secret-token" }
        });
    });

    it("does not add an Authorization header when there is no token", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue(
                new Response(JSON.stringify({ item: { id: "p1", name: "test" } }), { status: 200 })
            );
        vi.stubGlobal("fetch", fetchMock);

        const client = createClient();
        await client.request(getRoute, { params: { id: "p1" } });

        expect(fetchMock).toHaveBeenCalledWith("/api/projects/p1", { method: "GET" });
    });

    it("clears auth and throws when the response is 401", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
        vi.stubGlobal("fetch", fetchMock);

        const authRepository = createFakeAuthRepository("secret-token");
        const client = createClient(authRepository);

        await expect(client.request(getRoute, { params: { id: "p1" } })).rejects.toThrow(
            "GET /api/projects/p1 failed: 401"
        );
        expect(authRepository.clearAuth).toHaveBeenCalledOnce();
    });
});
