import type React from "react";
import { Badge, Tooltip } from "@mantine/core";
import type { EngineStatus } from "#shared/engines/types.js";
import { ENGINE_STATUS_COLORS } from "./engineStatusColors.js";

interface EngineStatusBadgeProps {
    status: EngineStatus;
    engineVersion?: string | null;
}

export function EngineStatusBadge({
    status,
    engineVersion
}: EngineStatusBadgeProps): React.ReactNode {
    const badge = (
        <Badge size="xs" color={ENGINE_STATUS_COLORS[status]} variant="dot">
            {status}
        </Badge>
    );

    if (engineVersion) {
        return (
            <Tooltip label={`engines.node: ${engineVersion}`} position="top">
                {badge}
            </Tooltip>
        );
    }

    return badge;
}
