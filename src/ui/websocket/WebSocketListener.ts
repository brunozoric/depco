import { WebSocketListener as Abstraction } from "./abstractions/WebSocketListener.js";
import { EventBridge } from "../events/abstractions/EventBridge.js";
import type { EventName } from "../events/abstractions/EventBridge.js";
import { AuthRepository } from "../features/auth/abstractions/AuthRepository.js";
import "../events/eventMap.js";

interface WSMessage {
    type: string;
    data: unknown;
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_BACKOFF_STEPS = 3;

class WebSocketListenerImpl implements Abstraction.Interface {
    private socket: WebSocket | null = null;
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private manuallyDisconnected = false;

    public constructor(
        private readonly eventBridge: EventBridge.Interface,
        private readonly authRepository: AuthRepository.Interface
    ) {}

    public connect(): void {
        this.manuallyDisconnected = false;
        this.openSocket();
    }

    public disconnect(): void {
        this.manuallyDisconnected = true;
        this.clearReconnectTimer();
        this.socket?.close();
        this.socket = null;
    }

    private openSocket(): void {
        const socket = new WebSocket(this.buildUrl());

        socket.addEventListener("open", () => {
            const isReconnect = this.reconnectAttempts > 0;
            this.reconnectAttempts = 0;
            if (isReconnect) {
                this.eventBridge.emit("ws:reconnected", {} as never);
            }
        });

        socket.addEventListener("message", event => {
            this.handleMessage((event as MessageEvent).data as string);
        });

        socket.addEventListener("close", () => {
            if (!this.manuallyDisconnected) {
                this.scheduleReconnect();
            }
        });

        this.socket = socket;
    }

    private buildUrl(): string {
        const token = this.authRepository.token;
        const query = token ? `?token=${encodeURIComponent(token)}` : "";

        if (typeof window !== "undefined" && window.location) {
            const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
            return `${protocol}//${window.location.host}/ws${query}`;
        }
        return `ws://localhost:3001/ws${query}`;
    }

    private scheduleReconnect(): void {
        const step = Math.min(this.reconnectAttempts, RECONNECT_MAX_BACKOFF_STEPS - 1);
        const delay = RECONNECT_BASE_DELAY_MS * 2 ** step;
        this.reconnectAttempts += 1;

        this.clearReconnectTimer();
        this.reconnectTimer = setTimeout(() => {
            this.openSocket();
        }, delay);
    }

    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    private handleMessage(raw: string): void {
        let message: WSMessage;
        try {
            message = JSON.parse(raw) as WSMessage;
        } catch {
            return;
        }

        this.eventBridge.emit(message.type as EventName, message.data as never);
    }
}

export const WebSocketListener = Abstraction.createImplementation({
    implementation: WebSocketListenerImpl,
    dependencies: [EventBridge, AuthRepository]
});
