import type { EngineStatus } from "#shared/engines/types.js";

export const ENGINE_STATUS_COLORS: Record<EngineStatus, string> = {
    current: "green",
    "active-lts": "green",
    maintenance: "yellow",
    eol: "red",
    unknown: "gray"
};
