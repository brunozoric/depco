import type { Container } from "@webiny/di";
import { notifications } from "@mantine/notifications";
import type { WSJobStatus } from "#shared/websocket/types.js";
import { ProjectsRepository } from "#ui/features/Projects/abstractions/ProjectsRepository.js";
import { navigate } from "../../Router/router.js";
import { TERMINAL_JOB_STATUSES } from "#shared/jobs/index.js";

interface NotificationConfig {
    color: string;
    prefix: string;
    autoClose: number | false;
}

const STATUS_CONFIG: Record<string, NotificationConfig> = {
    completed: { color: "green", prefix: "✓", autoClose: 5000 },
    failed: { color: "red", prefix: "✕", autoClose: false },
    cancelled: { color: "yellow", prefix: "⚠", autoClose: 5000 },
    interrupted: { color: "orange", prefix: "⚠", autoClose: false }
};

function humanizeJobType(type: string): string {
    const spaced = type.replace(/([A-Z])/g, " $1").toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function createJobStatusNotificationHandler(
    container: Container
): (data: WSJobStatus) => void {
    const projectsRepository = container.resolve(ProjectsRepository);

    return (data: WSJobStatus): void => {
        if (!TERMINAL_JOB_STATUSES.has(data.status)) {
            return;
        }

        const config = STATUS_CONFIG[data.status];
        if (!config) {
            return;
        }

        const label = humanizeJobType(data.type);
        let suffix = "";
        if (data.referenceType === "project") {
            const projectName = projectsRepository.getProject(data.referenceId)?.name;
            suffix = projectName ? ` — ${projectName}` : "";
        } else {
            suffix = ` — ${data.referenceId}`;
        }

        notifications.show({
            id: data.jobId,
            color: config.color,
            title: `${config.prefix} ${label} job ${data.status}${suffix}`,
            message: "Click to view jobs",
            autoClose: config.autoClose,
            style: { cursor: "pointer" },
            onClick: () => {
                navigate("/jobs");
                notifications.hide(data.jobId);
            }
        });
    };
}
