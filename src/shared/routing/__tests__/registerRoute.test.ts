import { describe, it, expect } from "vitest";
import { z } from "zod";
import Fastify from "fastify";
import { Result } from "#shared/index.js";
import { defineRoute } from "../defineRoute.js";
import { registerRoute } from "../registerRoute.js";

describe("registerRoute", () => {
    it("validates params and calls handler with parsed data", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/api/projects/:id",
            description: "Get project",
            params: z.object({ id: z.string().min(1) }),
            response: z.object({ item: z.object({ id: z.string() }) })
        });

        registerRoute(app, route, {}, async (request, _reply, send) => {
            return send.one({ result: Result.ok({ id: request.params.id }) });
        });

        const response = await app.inject({ method: "GET", url: "/api/projects/p1" });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ item: { id: "p1" } });
    });

    it("validates body and calls handler with parsed data", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "POST",
            path: "/api/projects",
            description: "Create project",
            params: z.object({}),
            body: z.object({ path: z.string().min(1) }),
            response: z.object({ item: z.object({ path: z.string() }) })
        });

        registerRoute(app, route, {}, async (request, _reply, send) => {
            return send.one({ result: Result.ok({ path: request.body.path }) });
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/projects",
            payload: { path: "/tmp/project" }
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ item: { path: "/tmp/project" } });
    });

    it("validates body and rejects invalid input with 400", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "POST",
            path: "/api/projects",
            description: "Create project",
            params: z.object({}),
            body: z.object({ path: z.string().min(1) }),
            response: z.object({ item: z.object({ id: z.string() }) })
        });

        registerRoute(app, route, {}, async (_request, _reply, send) => {
            return send.one({ result: Result.ok({ id: "new" }) });
        });

        const response = await app.inject({
            method: "POST",
            url: "/api/projects",
            payload: { path: "" }
        });
        expect(response.statusCode).toBe(400);
    });

    it("rejects invalid params with 400", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/api/projects/:id",
            description: "Get project",
            params: z.object({ id: z.string().regex(/^\d+$/) }),
            response: z.object({ item: z.object({ id: z.string() }) })
        });

        registerRoute(app, route, {}, async (request, _reply, send) => {
            return send.one({ result: Result.ok({ id: request.params.id }) });
        });

        const response = await app.inject({ method: "GET", url: "/api/projects/not-a-number" });
        expect(response.statusCode).toBe(400);
    });

    it("rejects invalid querystring with 400", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/api/projects",
            description: "List projects",
            params: z.object({}),
            querystring: z.object({ status: z.enum(["pending", "done"]) }),
            response: z.object({ item: z.object({ id: z.string() }) })
        });

        registerRoute(app, route, {}, async (_request, _reply, send) => {
            return send.one({ result: Result.ok({ id: "p1" }) });
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/projects?status=invalid"
        });
        expect(response.statusCode).toBe(400);
    });

    it("validates querystring and calls handler with parsed data", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/api/projects",
            description: "List projects",
            params: z.object({}),
            querystring: z.object({ status: z.enum(["pending", "done"]) }),
            response: z.object({ item: z.object({ status: z.string() }) })
        });

        registerRoute(app, route, {}, async (request, _reply, send) => {
            return send.one({ result: Result.ok({ status: request.query.status }) });
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/projects?status=pending"
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ item: { status: "pending" } });
    });

    describe("send helpers", () => {
        it("send.one wraps result in { item: ... }", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "GET",
                path: "/api/items/:id",
                description: "Get item",
                params: z.object({ id: z.string() }),
                response: z.object({ item: z.object({ id: z.string(), name: z.string() }) })
            });

            registerRoute(app, route, {}, async (request, _reply, send) => {
                return send.one({
                    result: Result.ok({ id: request.params.id, name: "test" })
                });
            });

            const response = await app.inject({ method: "GET", url: "/api/items/x1" });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ item: { id: "x1", name: "test" } });
        });

        it("send.one with custom status code", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "POST",
                path: "/api/items",
                description: "Create item",
                params: z.object({}),
                body: z.object({ name: z.string() }),
                response: z.object({ item: z.object({ id: z.string() }) })
            });

            registerRoute(app, route, {}, async (_request, _reply, send) => {
                return send.one({ result: Result.ok({ id: "new-1" }), status: 201 });
            });

            const response = await app.inject({
                method: "POST",
                url: "/api/items",
                payload: { name: "test" }
            });
            expect(response.statusCode).toBe(201);
            expect(response.json()).toEqual({ item: { id: "new-1" } });
        });

        it("send.one returns error on Result.fail", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "GET",
                path: "/api/items/:id",
                description: "Get item",
                params: z.object({ id: z.string() }),
                response: z.object({ item: z.object({ id: z.string() }) })
            });

            registerRoute(app, route, {}, async (_request, _reply, send) => {
                return send.one({
                    result: Result.fail({
                        code: "NOT_FOUND",
                        statusCode: 404,
                        message: "Item not found"
                    })
                });
            });

            const response = await app.inject({ method: "GET", url: "/api/items/x1" });
            expect(response.statusCode).toBe(404);
            expect(response.json()).toEqual({
                error: { code: "NOT_FOUND", message: "Item not found" }
            });
        });

        it("send.list sends result value directly (no item wrapper)", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "GET",
                path: "/api/items",
                description: "List items",
                params: z.object({}),
                response: z.object({
                    items: z.array(z.object({ id: z.string() })),
                    total: z.number()
                })
            });

            registerRoute(app, route, {}, async (_request, _reply, send) => {
                return send.list({
                    result: Result.ok({ items: [{ id: "a" }, { id: "b" }], total: 2 })
                });
            });

            const response = await app.inject({ method: "GET", url: "/api/items" });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ items: [{ id: "a" }, { id: "b" }], total: 2 });
        });

        it("send.list returns error on Result.fail", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "GET",
                path: "/api/items",
                description: "List items",
                params: z.object({}),
                response: z.object({
                    items: z.array(z.object({ id: z.string() })),
                    total: z.number()
                })
            });

            registerRoute(app, route, {}, async (_request, _reply, send) => {
                return send.list({
                    result: Result.fail({
                        code: "FORBIDDEN",
                        statusCode: 403,
                        message: "Access denied"
                    })
                });
            });

            const response = await app.inject({ method: "GET", url: "/api/items" });
            expect(response.statusCode).toBe(403);
            expect(response.json()).toEqual({
                error: { code: "FORBIDDEN", message: "Access denied" }
            });
        });

        it("send.none sends { success: true } on Result.ok", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "DELETE",
                path: "/api/items/:id",
                description: "Delete item",
                params: z.object({ id: z.string() })
            });

            registerRoute(app, route, {}, async (_request, _reply, send) => {
                return send.none({ result: Result.ok(undefined) });
            });

            const response = await app.inject({ method: "DELETE", url: "/api/items/x1" });
            expect(response.statusCode).toBe(200);
            expect(response.json()).toEqual({ success: true });
        });

        it("send.none with 204 sends empty body", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "DELETE",
                path: "/api/items/:id",
                description: "Delete item",
                params: z.object({ id: z.string() })
            });

            registerRoute(app, route, {}, async (_request, _reply, send) => {
                return send.none({ result: Result.ok(undefined), status: 204 });
            });

            const response = await app.inject({ method: "DELETE", url: "/api/items/x1" });
            expect(response.statusCode).toBe(204);
            expect(response.body).toBe("");
        });

        it("send.none returns error on Result.fail", async () => {
            const app = Fastify();
            const route = defineRoute({
                method: "DELETE",
                path: "/api/items/:id",
                description: "Delete item",
                params: z.object({ id: z.string() })
            });

            registerRoute(app, route, {}, async (_request, _reply, send) => {
                return send.none({
                    result: Result.fail({
                        code: "NOT_FOUND",
                        statusCode: 404,
                        message: "Item not found"
                    })
                });
            });

            const response = await app.inject({ method: "DELETE", url: "/api/items/x1" });
            expect(response.statusCode).toBe(404);
            expect(response.json()).toEqual({
                error: { code: "NOT_FOUND", message: "Item not found" }
            });
        });
    });
});
