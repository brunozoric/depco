import { createAbstraction } from "#shared/index.js";
import type { WSEventMap, WSEventType } from "#shared/websocket/types.js";

// Structural connection type — matches both `ws`'s WebSocket instances (as
// handed to us by @fastify/websocket) and the plain mock objects used in
// tests. Only the members the broadcaster actually needs are declared here.
export interface IWebSocketConnection {
    readyState: number;
    send(data: string): void;
    close(): void;
}

export interface IWebSocketBroadcaster {
    broadcast<T extends WSEventType>(type: T, data: WSEventMap[T]): void;
    addClient(connection: IWebSocketConnection, userId: string): void;
    removeClient(connection: IWebSocketConnection): void;
    closeConnectionsForUser(userId: string): void;
}

export const WebSocketBroadcaster = createAbstraction<IWebSocketBroadcaster>(
    "Api/WebSocketBroadcaster"
);

export namespace WebSocketBroadcaster {
    export type Interface = IWebSocketBroadcaster;
    export type Connection = IWebSocketConnection;
    export type EventMap = WSEventMap;
    export type EventType = WSEventType;
}
