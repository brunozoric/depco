import type { FastifyReply } from "fastify";

interface ISendOneInput<T> {
    reply: FastifyReply;
    data: T;
    status?: number;
}

export function sendOne<T>({ reply, data, status = 200 }: ISendOneInput<T>): void {
    reply.status(status).send({ item: data });
}
