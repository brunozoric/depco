import { notifications } from "@mantine/notifications";
import type { WSSnoozeExpired } from "#shared/websocket/types.js";
import { navigate } from "../../Router/router.js";

let lastNotificationTime = 0;
const DEDUP_WINDOW_MS = 60000;

export function handleSnoozeExpired(data: WSSnoozeExpired): void {
    if (data.count === 0) {
        return;
    }

    const now = Date.now();
    if (now - lastNotificationTime < DEDUP_WINDOW_MS) {
        return;
    }
    lastNotificationTime = now;

    const names = data.packageNames.slice(0, 3).join(", ");
    const suffix = data.packageNames.length > 3 ? ` and ${data.packageNames.length - 3} more` : "";

    notifications.show({
        color: "orange",
        title: `${data.count} snoozed ${data.count === 1 ? "vulnerability has" : "vulnerabilities have"} expired`,
        message: `${names}${suffix} — click to view`,
        autoClose: 10000,
        style: { cursor: "pointer" },
        onClick: () => {
            navigate("/vulnerabilities");
        }
    });
}
