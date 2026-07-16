import { notifications } from "@mantine/notifications";
import type { IConfigError } from "#ui/features/settings/abstractions/PmSettingsGateway.js";
import { navigate } from "../router/router.js";

export function showConfigErrorToast(error: IConfigError): void {
    notifications.show({
        id: "config-error",
        color: "yellow",
        title: "Config file error",
        message: `${error.type === "json" ? "JSON parse" : "Schema validation"} error: ${error.message}`,
        autoClose: false,
        style: { cursor: "pointer" },
        onClick: () => {
            navigate("/settings");
            notifications.hide("config-error");
        }
    });
}
