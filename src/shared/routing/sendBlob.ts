import type { FastifyReply } from "fastify";

interface ISendBlobInput {
    reply: FastifyReply;
    content: Record<string, unknown>;
    filename: string;
    mediaType: string;
}

export function sendBlob({ reply, content, filename, mediaType }: ISendBlobInput): void {
    const json = JSON.stringify(content, null, 2);
    const buffer = Buffer.from(json, "utf-8");
    reply
        .status(200)
        .header("Content-Type", mediaType)
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
}
