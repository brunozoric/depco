import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";

declare module "fastify" {
    interface FastifyRequest {
        // Child of the root container, created per request. Route handlers
        // resolve from it so request-scoped registrations never leak between
        // requests; root singletons are still shared.
        container: Container;
    }
}

// Gives every request its own child container. Must be registered before any
// other onRequest hook that resolves dependencies.
export function registerRequestContainer(app: FastifyInstance, root: Container): void {
    app.decorateRequest("container", null as unknown as Container);
    app.addHook("onRequest", async request => {
        request.container = root.createChildContainer();
    });
}
