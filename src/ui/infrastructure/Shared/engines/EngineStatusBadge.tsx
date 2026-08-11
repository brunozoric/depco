import type React from "react";
import { Badge } from "@mantine/core";
import type { EngineStatus } from "#shared/engines/types.js";
import { ENGINE_STATUS_COLORS } from "./engineStatusColors.js";

interface IEngineStatusBadgeProps {
    status: EngineStatus;
}

export function EngineStatusBadge({ status }: IEngineStatusBadgeProps): React.ReactNode {
    return (
        <Badge size="xs" color={ENGINE_STATUS_COLORS[status]} variant="dot">
            {status}
        </Badge>
    );
}
