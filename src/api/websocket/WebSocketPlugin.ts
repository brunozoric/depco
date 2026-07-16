import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import fastifyWebsocket from "@fastify/websocket";
import { WebSocketBroadcaster } from "./abstractions/WebSocketBroadcaster.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function websocketRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const broadcaster = container.resolve(WebSocketBroadcaster);

    await app.register(fastifyWebsocket);

    // GET /ws — clients connect here to receive broadcast events (scan
    // progress, job status, notifications). The connection is registered
    // with the broadcaster and removed on close/error.
    app.get("/ws", { websocket: true }, socket => {
        broadcaster.addClient(socket);

        socket.on("close", () => {
            broadcaster.removeClient(socket);
        });

        socket.on("error", () => {
            broadcaster.removeClient(socket);
        });
    });
}
