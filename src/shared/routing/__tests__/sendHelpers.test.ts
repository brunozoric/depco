import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { z } from "zod";
import { defineRoute } from "../defineRoute.js";
import { registerRoute } from "../registerRoute.js";
import { sendError, sendBlob } from "../index.js";

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

    it("sendBlob sets Content-Disposition and Content-Type headers and sends JSON buffer", async () => {
        const app = Fastify();
        const route = defineRoute({
            method: "GET",
            path: "/test-blob",
            description: "test",
            params: z.object({}),
            response: z.any()
        });
        registerRoute(app, route, {}, async (_request, reply) => {
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
