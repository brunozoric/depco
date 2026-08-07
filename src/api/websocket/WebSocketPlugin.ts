import { createHash } from "crypto";
import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import type { Container } from "@webiny/di";
import fastifyWebsocket from "@fastify/websocket";
import { WebSocketBroadcaster } from "./abstractions/WebSocketBroadcaster.js";
import { AuthService } from "#api/services/abstractions/AuthService.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

interface IWebSocketQuerystring {
    token?: string;
}

export async function websocketRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const broadcaster = container.resolve(WebSocketBroadcaster);
    const authService = container.resolve(AuthService);

    await app.register(fastifyWebsocket);

    // GET /ws — clients connect here to receive broadcast events (scan
    // progress, job status, notifications). The connection is authenticated
    // via a `?token=` query param (the raw session token, same one used for
    // `Authorization: Bearer` on HTTP requests), then registered with the
    // broadcaster and removed on close/error.
    app.get(
        "/ws",
        { websocket: true },
        async (socket, request: FastifyRequest<{ Querystring: IWebSocketQuerystring }>) => {
            const rawToken = request.query.token;

            if (!rawToken) {
                socket.close();
                return;
            }

            const tokenHash = createHash("sha256").update(rawToken).digest("hex");
            const sessionUser = await authService.getSessionUser(tokenHash);

            if (!sessionUser) {
                socket.close();
                return;
            }

            broadcaster.addClient(socket, sessionUser.id);

            socket.on("close", () => {
                broadcaster.removeClient(socket);
            });

            socket.on("error", () => {
                broadcaster.removeClient(socket);
            });
        }
    );
}
