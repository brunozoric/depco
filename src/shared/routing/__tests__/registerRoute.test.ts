import { describe, it, expect } from "vitest";
import { z } from "zod";
import Fastify from "fastify";
import { defineRoute } from "../defineRoute.js";
import { registerRoute } from "../registerRoute.js";
import { sendOne } from "../sendOne.js";

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

        registerRoute(app, route, {}, async (request, reply) => {
            sendOne({ reply, data: { id: request.params.id } });
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

        registerRoute(app, route, {}, async (request, reply) => {
            sendOne({ reply, data: { path: request.body.path } });
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

        registerRoute(app, route, {}, async (_request, reply) => {
            sendOne({ reply, data: { id: "new" } });
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

        registerRoute(app, route, {}, async (request, reply) => {
            sendOne({ reply, data: { id: request.params.id } });
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

        registerRoute(app, route, {}, async (_request, reply) => {
            sendOne({ reply, data: { id: "p1" } });
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

        registerRoute(app, route, {}, async (request, reply) => {
            sendOne({ reply, data: { status: request.query.status } });
        });

        const response = await app.inject({
            method: "GET",
            url: "/api/projects?status=pending"
        });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ item: { status: "pending" } });
    });
});
