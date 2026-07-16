import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@mantine/notifications", () => ({
    notifications: {
        show: vi.fn()
    }
}));

vi.mock("../../router/router.js", () => ({
    navigate: vi.fn()
}));

import { handleSnoozeExpired } from "../snoozeNotifications.js";
import { notifications } from "@mantine/notifications";
import { navigate } from "../../router/router.js";

interface NotificationClickHandler {
    onClick: () => void;
}

const DEDUP_WINDOW_MS = 60000;

describe("handleSnoozeExpired", () => {
    // `handleSnoozeExpired` tracks the last notification time in module scope
    // to dedupe rapid-fire calls (see finding: WebSocket + page-load double toast).
    // Each test advances the fake clock well past the dedup window so tests
    // remain independent of each other.
    let currentTime = Date.now();

    beforeEach(() => {
        vi.clearAllMocks();
        currentTime += DEDUP_WINDOW_MS + 1000;
        vi.useFakeTimers();
        vi.setSystemTime(currentTime);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does nothing when count is zero", () => {
        handleSnoozeExpired({ count: 0, packageNames: [] });

        expect(notifications.show).not.toHaveBeenCalled();
    });

    it("shows a singular title for a single expired snooze", () => {
        handleSnoozeExpired({ count: 1, packageNames: ["lodash"] });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                color: "orange",
                title: "1 snoozed vulnerability has expired",
                autoClose: 10000
            })
        );
    });

    it("shows a plural title for multiple expired snoozes", () => {
        handleSnoozeExpired({ count: 2, packageNames: ["lodash", "axios"] });

        expect(notifications.show).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "2 snoozed vulnerabilities have expired"
            })
        );
    });

    it("lists up to three package names without a suffix", () => {
        handleSnoozeExpired({ count: 3, packageNames: ["lodash", "axios", "react"] });

        const call = vi.mocked(notifications.show).mock.calls[0]![0];
        expect(call.message).toBe("lodash, axios, react — click to view");
    });

    it("truncates to three names and appends a count for the rest", () => {
        handleSnoozeExpired({
            count: 5,
            packageNames: ["lodash", "axios", "react", "vue", "svelte"]
        });

        const call = vi.mocked(notifications.show).mock.calls[0]![0];
        expect(call.message).toBe("lodash, axios, react and 2 more — click to view");
    });

    it("navigates to /vulnerabilities on click", () => {
        handleSnoozeExpired({ count: 1, packageNames: ["lodash"] });

        const firstCall = vi.mocked(notifications.show).mock.calls[0];
        if (!firstCall) {
            throw new Error("Expected notifications.show to have been called");
        }
        const call = firstCall[0] as unknown as NotificationClickHandler;
        call.onClick();

        expect(navigate).toHaveBeenCalledWith("/vulnerabilities");
    });

    it("suppresses a duplicate toast fired within the dedup window", () => {
        handleSnoozeExpired({ count: 1, packageNames: ["lodash"] });
        expect(notifications.show).toHaveBeenCalledTimes(1);

        handleSnoozeExpired({ count: 1, packageNames: ["lodash"] });
        expect(notifications.show).toHaveBeenCalledTimes(1);
    });

    it("shows a new toast once the dedup window has elapsed", () => {
        handleSnoozeExpired({ count: 1, packageNames: ["lodash"] });
        expect(notifications.show).toHaveBeenCalledTimes(1);

        vi.setSystemTime(currentTime + DEDUP_WINDOW_MS + 1);
        handleSnoozeExpired({ count: 1, packageNames: ["lodash"] });
        expect(notifications.show).toHaveBeenCalledTimes(2);
    });
});
