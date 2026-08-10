import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { z } from "zod";
import { defineRoute } from "../defineRoute.js";
import { registerRoute } from "../registerRoute.js";
import { sendOne, sendList, sendNone, sendError, sendBlob } from "../index.js";

describe("response helpers", () => {
    it("sendOne wraps value in { item }", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() }),
            response: z.object({ item: z.object({ name: z.string() }) })
        });
        registerRoute(app, route, {}, async (_req, reply) => {
            sendOne({ reply, data: { name: "hello" } });
        });

        const res = await app.inject({ method: "GET", url: "/test/1" });
        expect(res.json()).toEqual({ item: { name: "hello" } });
    });

    it("sendList wraps values in { items, total }", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test",
            description: "test",
            params: z.object({}),
            response: z.object({ items: z.array(z.string()), total: z.number() })
        });
        registerRoute(app, route, {}, async (_req, reply) => {
            sendList({ reply, items: ["a", "b"], total: 2 });
        });

        const res = await app.inject({ method: "GET", url: "/test" });
        expect(res.json()).toEqual({ items: ["a", "b"], total: 2 });
    });

    it("sendNone sends { success: true }", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "DELETE",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (_req, reply) => {
            sendNone(reply);
        });

        const res = await app.inject({ method: "DELETE", url: "/test/1" });
        expect(res.json()).toEqual({ success: true });
    });

    it("sendError sends error with status code", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test/:id",
            description: "test",
            params: z.object({ id: z.string() })
        });
        registerRoute(app, route, {}, async (_req, reply) => {
            sendError({ reply, statusCode: 404, message: "Not found" });
        });

        const res = await app.inject({ method: "GET", url: "/test/1" });
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ error: { message: "Not found" } });
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
