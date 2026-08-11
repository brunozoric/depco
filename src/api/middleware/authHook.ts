import { createHash } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Container } from "@webiny/di";
import { AuthService } from "#api/services/Auth/index.js";

export interface IAuthenticatedRequest extends FastifyRequest {
    user: AuthService.SessionUser;
}

const AUTH_WHITELIST = new Set([
    "GET /api/health",
    "POST /api/auth/login",
    "POST /api/auth/verify-code",
    "POST /api/auth/magic-link",
    "POST /api/auth/verify-magic-link"
]);

export function createAuthHook(container: Container) {
    const authService = container.resolve(AuthService);

    return async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
        const url = request.routeOptions.url ?? request.url;

        if (!url.startsWith("/api/")) {
            return;
        }

        const routeKey = `${request.method} ${url}`;

        if (AUTH_WHITELIST.has(routeKey)) {
            return;
        }

        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            reply.status(401).send({ error: { message: "Authentication required" } });
            return;
        }

        const rawToken = authHeader.slice(7);
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");

        const sessionUser = await authService.getSessionUser(tokenHash);
        if (!sessionUser) {
            reply.status(401).send({ error: { message: "Session expired" } });
            return;
        }

        (request as IAuthenticatedRequest).user = sessionUser;
    };
}
