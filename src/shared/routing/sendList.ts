import type { FastifyReply } from "fastify";

export function sendList<T>(reply: FastifyReply, items: T[], total: number, status = 200): void {
    reply.status(status).send({ items, total });
}
