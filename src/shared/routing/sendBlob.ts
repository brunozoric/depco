import type { FastifyReply } from "fastify";

export function sendBlob(
    reply: FastifyReply,
    content: Record<string, unknown>,
    filename: string,
    mediaType: string
): void {
    const json = JSON.stringify(content, null, 2);
    const buffer = Buffer.from(json, "utf-8");
    reply
        .status(200)
        .header("Content-Type", mediaType)
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buffer);
}
