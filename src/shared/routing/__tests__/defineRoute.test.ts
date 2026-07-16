import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineRoute } from "../defineRoute.js";

describe("defineRoute", () => {
    it("creates a route definition with all fields", () => {
        const route = defineRoute({
            method: "POST",
            path: "/api/projects/:id/scan",
            description: "Start scan",
            params: z.object({ id: z.string() }),
            body: z.object({ force: z.boolean() }),
            response: z.object({ item: z.object({ jobId: z.string() }) })
        });

        expect(route.method).toBe("POST");
        expect(route.path).toBe("/api/projects/:id/scan");
        expect(route.description).toBe("Start scan");
        expect(route.params).toBeDefined();
        expect(route.body).toBeDefined();
        expect(route.response).toBeDefined();
    });

    it("creates a route without optional body and response", () => {
        const route = defineRoute({
            method: "DELETE",
            path: "/api/cache/:packageName",
            description: "Clear cache",
            params: z.object({ packageName: z.string() })
        });

        expect(route.body).toBeUndefined();
        expect(route.response).toBeUndefined();
    });
});
