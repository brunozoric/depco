import type { WSEventMap } from "#shared/websocket/types.js";

declare module "./abstractions/EventBridge.js" {
    interface IEventMap {
        "scan:progress": WSEventMap["scan:progress"];
        "scan:complete": WSEventMap["scan:complete"];
        "scan:failed": WSEventMap["scan:failed"];
        "job:status": WSEventMap["job:status"];
        "job:log": WSEventMap["job:log"];
        "job:progress": WSEventMap["job:progress"];
        "install:complete": WSEventMap["install:complete"];
        notification: WSEventMap["notification"];
        "upgrade-session:step-progress": WSEventMap["upgrade-session:step-progress"];
        "upgrade-session:step-complete": WSEventMap["upgrade-session:step-complete"];
        "log:created": WSEventMap["log:created"];
        "changelog:resolved": WSEventMap["changelog:resolved"];
        "snooze:expired": WSEventMap["snooze:expired"];
        "license-scan:progress": WSEventMap["license-scan:progress"];
        "license-scan:complete": WSEventMap["license-scan:complete"];
        "auto-fix:progress": WSEventMap["auto-fix:progress"];
        "auto-fix:complete": WSEventMap["auto-fix:complete"];
        "transitive-resolve:complete": WSEventMap["transitive-resolve:complete"];
        "engine-scan:complete": WSEventMap["engine-scan:complete"];
        "ws:reconnected": Record<string, never>;
    }
}
