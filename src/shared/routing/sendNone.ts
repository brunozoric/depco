import type { FastifyReply } from "fastify";

export function sendNone(reply: FastifyReply, status = 200): void {
    if (status === 204) {
        reply.status(204).send();
        return;
    }
    reply.status(status).send({ success: true });
}
