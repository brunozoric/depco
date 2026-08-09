import type React from "react";
import { useEffect } from "react";
import { createJobStatusNotificationHandler } from "./infrastructure/Shared/notifications/jobNotifications.js";
import { showConfigErrorToast } from "./infrastructure/Shared/notifications/configErrorNotification.js";
import { handleSnoozeExpired } from "./infrastructure/Shared/notifications/snoozeNotifications.js";
import { useContainer } from "#ui/infrastructure/Shared/di/ContainerProvider.js";
import { AuthGateway } from "#ui/features/Auth/abstractions/AuthGateway.js";
import { AuthRepository } from "#ui/features/Auth/abstractions/AuthRepository.js";
import { PmSettingsGateway } from "#ui/features/Settings/abstractions/PmSettingsGateway.js";
import { AppSettingsGateway } from "#ui/features/AppSettings/abstractions/AppSettingsGateway.js";
import { WebSocketListener } from "#ui/infrastructure/WebSocket/index.js";
import { EventBridge } from "#ui/infrastructure/Events/abstractions/EventBridge.js";
import "#ui/infrastructure/Events/eventMap.js";
import { TeamListService } from "#ui/features/TeamFilter/abstractions/TeamListService.js";
import { LoginPageFeature } from "./presentation/Auth/LoginPage/feature.js";

// Establishes the WebSocket connection once on app mount and tears it down
// on unmount. Renders nothing — it only manages the connection lifecycle.
function WebSocketConnector(): null {
    const container = useContainer();

    useEffect(() => {
        const listener = container.resolve(WebSocketListener);
        listener.connect();
        return () => {
            listener.disconnect();
        };
    }, [container]);

    return null;
}

// Restores the session on app mount by validating the cached token against
// the server. Clears auth if the token is no longer valid. Renders nothing.
function SessionRestorer(): null {
    const container = useContainer();

    useEffect(() => {
        const authRepository = container.resolve(AuthRepository);
        const token = authRepository.token;
        if (!token) {
            return;
        }

        const authGateway = container.resolve(AuthGateway);
        authGateway
            .getMe()
            .then(user => {
                authRepository.setAuth({ token, user });
            })
            .catch(() => {
                authRepository.clearAuth();
            });
    }, [container]);

    return null;
}

// Checks the URL for a magic-link token/email pair on app mount, verifies it,
// and strips the params from the URL once handled. Renders nothing.
function MagicLinkHandler(): null {
    const container = useContainer();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        const email = params.get("email");
        if (!token || !email) {
            return;
        }

        const { presenter } = LoginPageFeature.resolve(container);
        void presenter.verifyMagicLink({ token, email });

        const url = new URL(window.location.href);
        url.searchParams.delete("token");
        url.searchParams.delete("email");
        window.history.replaceState(null, "", url.toString());
    }, [container]);

    return null;
}

// Subscribes to job status events via EventBridge and shows toast notifications
// for terminal job states. Renders nothing — it only manages the subscription.
function JobNotificationListener(): null {
    const container = useContainer();

    useEffect(() => {
        const eventBridge = container.resolve(EventBridge);
        const handler = createJobStatusNotificationHandler(container);
        eventBridge.on("job:status", handler);
        return () => {
            eventBridge.off("job:status", handler);
        };
    }, [container]);

    return null;
}

// Subscribes to snooze-expiry events via EventBridge and shows toast
// notifications when snoozed vulnerabilities expire. Renders nothing — it only
// manages the subscription.
function SnoozeExpiryListener(): null {
    const container = useContainer();

    useEffect(() => {
        const eventBridge = container.resolve(EventBridge);
        eventBridge.on("snooze:expired", handleSnoozeExpired);
        return () => {
            eventBridge.off("snooze:expired", handleSnoozeExpired);
        };
    }, [container]);

    return null;
}

// Checks the config file for parse/validation errors on app mount and
// shows a toast notification if any are found. Renders nothing.
function ConfigErrorNotifier(): null {
    const container = useContainer();

    useEffect(() => {
        const pmGateway = container.resolve(PmSettingsGateway);
        const appGateway = container.resolve(AppSettingsGateway);

        Promise.all([pmGateway.listPmConfig(), appGateway.list()]).then(([pmResult, appResult]) => {
            const error = pmResult.configError ?? appResult.configError;
            if (error) {
                showConfigErrorToast(error);
            }
        });
    }, [container]);

    return null;
}

// Loads the list of teams once on app mount so the global team filter
// Select has data to render. Renders nothing.
function TeamListLoader(): null {
    const container = useContainer();

    useEffect(() => {
        const teamListService = container.resolve(TeamListService);
        void teamListService.loadTeams();
    }, [container]);

    return null;
}

// Mounts all app-lifecycle renderless components: connection setup, session
// restoration, magic-link handling, event-driven notifications, and initial
// data loading. Renders nothing itself.
export function AppLifecycle(): React.ReactNode {
    return (
        <>
            <WebSocketConnector />
            <SessionRestorer />
            <MagicLinkHandler />
            <JobNotificationListener />
            <SnoozeExpiryListener />
            <ConfigErrorNotifier />
            <TeamListLoader />
        </>
    );
}
