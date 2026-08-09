import { createAbstraction } from "#shared/index.js";

export interface IEventMap {}

export type EventName = keyof IEventMap & string;

export interface IEventBridge {
    on<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void;
    off<K extends EventName>(event: K, handler: (data: IEventMap[K]) => void): void;
    emit<K extends EventName>(event: K, data: IEventMap[K]): void;
}

export const EventBridge = createAbstraction<IEventBridge>("Ui/EventBridge");

export namespace EventBridge {
    export type Interface = IEventBridge;
    export type EventMap = IEventMap;
    export type EventName = import("./EventBridge.js").EventName;
    export type Callback<K extends EventName> = (data: IEventMap[K]) => void;
}
