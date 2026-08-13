import type { ErrorLoggerHook } from "./ErrorLoggerHook.js";

export interface RoutingOptions {
    showStackTrace: boolean;
    errorLoggerHook?: ErrorLoggerHook.Interface;
}
