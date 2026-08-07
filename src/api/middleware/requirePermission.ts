import type { FastifyRequest, FastifyReply } from "fastify";
import type { IAuthenticatedRequest } from "./authHook.js";

export function requirePermission(permission: string) {
    return async function permissionCheck(
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> {
        const user = (request as IAuthenticatedRequest).user;

        if (!user) {
            reply.status(401).send({ error: { message: "Authentication required" } });
            return;
        }

        if (user.permission !== permission) {
            reply.status(403).send({ error: { message: "Insufficient permission" } });
            return;
        }
    };
}
