import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { z } from "zod";
import { Result } from "#shared/index.js";
import { defineRoute } from "../defineRoute.js";
import { registerRoute } from "../registerRoute.js";
import { sendOne, sendList, sendNone, sendError, sendBlob } from "../index.js";

describe("response helpers", () => {
    it("sendError sends structured error with code and message", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            return sendError({
                reply,
                request,
                error: { code: "NOT_FOUND", message: "Not found", statusCode: 404 }
            });
        });

        const res = await app.inject({ method: "GET", url: "/test/1" });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
    });

    it("sendError defaults to status 400 when statusCode not provided", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            return sendError({
                reply,
                request,
                error: { code: "VALIDATION_ERROR", message: "Bad input" }
            });
        });

        const res = await app.inject({ method: "GET", url: "/test/1" });
        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: { code: "VALIDATION_ERROR", message: "Bad input" } });
    });

    it("sendError includes data when present", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            return sendError({
                reply,
                request,
                error: {
                    code: "VALIDATION_ERROR",
                    message: "Bad input",
                    statusCode: 400,
                    data: { field: "name" }
                }
            });
        });

        const res = await app.inject({ method: "GET", url: "/test/1" });
        expect(res.json()).toEqual({
            error: { code: "VALIDATION_ERROR", message: "Bad input", data: { field: "name" } }
        });
    });

    it("sendOne returns item envelope on success Result", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() }),
            response: z.object({ item: z.object({ name: z.string() }) })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.ok({ name: "hello" });
            return sendOne({ reply, request, result });
        });

        const res = await app.inject({ method: "GET", url: "/test/1" });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ item: { name: "hello" } });
    });

    it("sendOne returns error on fail Result", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.fail({
                code: "NOT_FOUND",
                message: "Not found",
                statusCode: 404
            });
            return sendOne({ reply, request, result });
        });

        const res = await app.inject({ method: "GET", url: "/test/1" });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
    });

    it("sendOne uses custom status on success", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "POST",
            path: "/test",
            description: "test",
            params: z.object({}),
            body: z.object({ name: z.string() }),
            response: z.object({ item: z.object({ name: z.string() }) })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.ok({ name: "created" });
            return sendOne({ reply, request, result, status: 201 });
        });

        const res = await app.inject({
            method: "POST",
            url: "/test",
            payload: { name: "created" }
        });
        expect(res.statusCode).toBe(201);
        expect(res.json()).toEqual({ item: { name: "created" } });
    });

    it("sendList returns items envelope on success Result", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test",
            description: "test",
            params: z.object({}),
            response: z.object({ items: z.array(z.string()), total: z.number() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.ok({ items: ["a", "b"], total: 2 });
            return sendList({ reply, request, result });
        });

        const res = await app.inject({ method: "GET", url: "/test" });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ items: ["a", "b"], total: 2 });
    });

    it("sendList returns error on fail Result", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test",
            description: "test",
            params: z.object({})
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.fail({
                code: "UNEXPECTED",
                message: "Something went wrong",
                statusCode: 500
            });
            return sendList({ reply, request, result });
        });

        const res = await app.inject({ method: "GET", url: "/test" });
        expect(res.statusCode).toBe(500);
        expect(res.json()).toEqual({
            error: { code: "UNEXPECTED", message: "Something went wrong" }
        });
    });

    it("sendNone sends { success: true } on success Result", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "PUT",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() }),
            body: z.object({ data: z.string() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.ok(undefined);
            return sendNone({ reply, request, result });
        });

        const res = await app.inject({
            method: "PUT",
            url: "/test/1",
            payload: { data: "x" }
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ success: true });
    });

    it("sendNone sends 204 with no body when status is 204", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "DELETE",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.ok(undefined);
            return sendNone({ reply, request, result, status: 204 });
        });

        const res = await app.inject({ method: "DELETE", url: "/test/1" });
        expect(res.statusCode).toBe(204);
        expect(res.body).toBe("");
    });

    it("sendNone sends error on fail Result", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "DELETE",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (request, reply) => {
            const result = Result.fail({
                code: "NOT_FOUND",
                message: "Not found",
                statusCode: 404
            });
            return sendNone({ reply, request, result });
        });

        const res = await app.inject({ method: "DELETE", url: "/test/1" });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: { code: "NOT_FOUND", message: "Not found" } });
    });

    it("sendBlob sets Content-Disposition and Content-Type headers and sends JSON buffer", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test-blob",
            description: "test",
            params: z.object({}),
            response: z.any()
        });
        registerRoute(app, route, {}, async (_req, reply) => {
            sendBlob({
                reply,
                content: { key: "value" },
                filename: "test-file.json",
                mediaType: "application/json"
            });
        });

        const res = await app.inject({ method: "GET", url: "/test-blob" });
        expect(res.statusCode).toBe(200);
        expect(res.headers["content-type"]).toBe("application/json");
        expect(res.headers["content-disposition"]).toBe('attachment; filename="test-file.json"');
        expect(JSON.parse(res.body)).toEqual({ key: "value" });
    });
});
