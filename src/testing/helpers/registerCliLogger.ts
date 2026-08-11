import type { Container } from "@webiny/di";
import { ConsoleLoggerConfig, ConsoleLoggerFeature } from "@webiny/stdlib";

export function registerCliLogger(container: Container): void {
    container.registerInstance(ConsoleLoggerConfig, {
        getConfig: () => ({ logLevel: "debug" as const })
    });
    ConsoleLoggerFeature.register(container);
}
