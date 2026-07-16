import { EventBridge as Abstraction } from "./abstractions/EventBridge.js";
import type { EventName, IEventMap } from "./abstractions/EventBridge.js";

type AnyHandler = (data: unknown) => void;

class EventBridgeImpl implements Abstraction.Interface {
    private readonly handlers = new Map<string, Set<AnyHandler>>();

    public on<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void {
        let set = this.handlers.get(event);
        if (!set) {
            set = new Set();
            this.handlers.set(event, set);
        }
        set.add(handler as AnyHandler);
    }

    public off<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void {
        this.handlers.get(event)?.delete(handler as AnyHandler);
    }

    public emit<K extends EventName>(event: K, data: IEventMap[K]): void {
        const set = this.handlers.get(event);
        if (!set) {
            return;
        }
        for (const handler of set) {
            handler(data);
        }
    }
}

export const EventBridge = Abstraction.createImplementation({
    implementation: EventBridgeImpl,
    dependencies: []
});
