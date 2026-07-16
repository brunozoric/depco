import type { FastifyReply } from "fastify";

export function sendOne<T>(reply: FastifyReply, data: T, status = 200): void {
    reply.status(status).send({ item: data });
}
