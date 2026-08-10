import type { FastifyReply } from "fastify";

interface ISendListInput<T> {
    reply: FastifyReply;
    items: T[];
    total: number;
    status?: number;
}

export function sendList<T>({ reply, items, total, status = 200 }: ISendListInput<T>): void {
    reply.status(status).send({ items, total });
}
