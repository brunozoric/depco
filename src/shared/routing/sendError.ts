import type { FastifyReply } from "fastify";

interface ISendErrorInput {
    reply: FastifyReply;
    statusCode: number;
    message: string;
}

export function sendError({ reply, statusCode, message }: ISendErrorInput): void {
    reply.status(statusCode).send({ error: { message } });
}
