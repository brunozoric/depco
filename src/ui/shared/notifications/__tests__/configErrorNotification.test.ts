import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifications } from "@mantine/notifications";
import { showConfigErrorToast } from "../configErrorNotification.js";

vi.mock("@mantine/notifications", () => ({
    notifications: {
        show: vi.fn()
    }
}));

vi.mock("../../router/router.js", () => ({
    navigate: vi.fn()
}));

describe("showConfigErrorToast", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows notification with yellow color and config-error id", () => {
        showConfigErrorToast({ type: "json", message: "Unexpected token" });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "config-error",
                color: "yellow",
                autoClose: false
            })
        );
    });

    it("includes error message in notification", () => {
        showConfigErrorToast({ type: "schema", message: "Unknown field" });

        const call = vi.mocked(notifications.show).mock.calls[0]![0];
        expect(call.message).toContain("Unknown field");
    });

    it("includes error type in title", () => {
        showConfigErrorToast({ type: "json", message: "bad" });

        const call = vi.mocked(notifications.show).mock.calls[0]![0];
        expect(call.title).toContain("Config file error");
    });
});
