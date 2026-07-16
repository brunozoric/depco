import { createAbstraction } from "#shared/index.js";

export interface IEventMap {}

export type EventName = keyof IEventMap;

export interface IEventBus {
    on<K extends EventName>(event: K, handler: (...args: IEventMap[K]) => void): void;
    off<K extends EventName>(event: K, handler: (...args: IEventMap[K]) => void): void;
    emit<K extends EventName>(event: K, ...args: IEventMap[K]): void;
}

export const EventBus = createAbstraction<IEventBus>("Api/EventBus");

export namespace EventBus {
    export type Interface = IEventBus;
}
