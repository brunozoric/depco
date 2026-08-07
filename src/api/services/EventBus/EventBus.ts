import { EventEmitter } from "events";
import { EventBus as Abstraction } from "./abstractions/EventBus.js";
import type { EventName, IEventMap } from "./abstractions/EventBus.js";

class EventBusImpl implements Abstraction.Interface {
    private readonly emitter = new EventEmitter();

    public on<K extends EventName>(event: K, handler: (...args: IEventMap[K]) => void): void {
        this.emitter.on(event, handler as (...args: unknown[]) => void);
    }

    public off<K extends EventName>(event: K, handler: (...args: IEventMap[K]) => void): void {
        this.emitter.off(event, handler as (...args: unknown[]) => void);
    }

    public emit<K extends EventName>(event: K, ...args: IEventMap[K]): void {
        this.emitter.emit(event, ...args);
    }
}

export const EventBus = Abstraction.createImplementation({
    implementation: EventBusImpl,
    dependencies: []
});
