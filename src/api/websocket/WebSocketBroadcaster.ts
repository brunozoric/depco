import { WebSocketBroadcaster as Abstraction } from "./abstractions/WebSocketBroadcaster.js";

const READY_STATE_OPEN = 1;

class WebSocketBroadcasterImpl implements Abstraction.Interface {
    private readonly clients = new Set<Abstraction.Connection>();

    public broadcast<T extends Abstraction.EventType>(
        type: T,
        data: Abstraction.EventMap[T]
    ): void {
        const payload = JSON.stringify({ type, data });

        for (const client of this.clients) {
            if (client.readyState !== READY_STATE_OPEN) {
                continue;
            }

            try {
                client.send(payload);
            } catch {
                // The client may have disconnected mid-broadcast — ignore
                // per-client send errors so one bad connection doesn't
                // prevent delivery to the rest.
            }
        }
    }

    public addClient(connection: Abstraction.Connection): void {
        this.clients.add(connection);
    }

    public removeClient(connection: Abstraction.Connection): void {
        this.clients.delete(connection);
    }
}

export const WebSocketBroadcaster = Abstraction.createImplementation({
    implementation: WebSocketBroadcasterImpl,
    dependencies: []
});
