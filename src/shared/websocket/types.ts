export interface WSScanProgress {
    projectId: string;
    packageName: string;
    current: number;
    total: number;
}

export interface WSScanComplete {
    projectId: string;
    warning: string | null;
}

export interface WSScanFailed {
    projectId: string;
    error: string;
}

export interface WSJobStatus {
    jobId: string;
    referenceId: string;
    referenceType: string;
    type: string;
    status: string;
}

export interface WSJobLog {
    jobId: string;
    referenceId: string;
    line: string;
}

export interface WSJobProgress {
    jobId: string;
    referenceId: string;
    progress: number;
    progressLabel: string | null;
}

export interface WSInstallComplete {
    projectId: string;
}

export interface WSNotification {
    message: string;
    level: "info" | "error";
}

export interface WSUpgradeSessionStepProgress {
    sessionId: string;
    stepType: string;
    log: string;
}

export interface WSUpgradeSessionStepComplete {
    sessionId: string;
    stepType: string;
}

export interface WSLogCreated {
    id: string;
    level: string;
    source: string;
    projectId: string | null;
    message: string;
    createdAt: number;
}

export interface WSChangelogResolved {
    packageName: string;
    version: string;
    content: string | null;
    source: string | null;
}

export interface WSSnoozeExpired {
    count: number;
    packageNames: string[];
}

export interface WSLicenseScanProgress {
    projectId: string;
    packageName: string;
    current: number;
    total: number;
}

export interface WSLicenseScanComplete {
    projectId: string;
    totalLicenses: number;
    violations: number;
}

export interface WSAutoFixProgress {
    projectId: string;
    packageName: string;
    step: "branch" | "upgrade" | "commit" | "push" | "create-pr";
    current: number;
    total: number;
}

export interface WSAutoFixComplete {
    projectId: string;
    created: number;
    skipped: number;
    failed: number;
}

export interface WSTransitiveResolveComplete {
    projectId: string;
    resolved: number;
    failed: number;
}

export type WSEventMap = {
    "scan:progress": WSScanProgress;
    "scan:complete": WSScanComplete;
    "scan:failed": WSScanFailed;
    "job:status": WSJobStatus;
    "job:log": WSJobLog;
    "job:progress": WSJobProgress;
    "install:complete": WSInstallComplete;
    notification: WSNotification;
    "upgrade-session:step-progress": WSUpgradeSessionStepProgress;
    "upgrade-session:step-complete": WSUpgradeSessionStepComplete;
    "log:created": WSLogCreated;
    "changelog:resolved": WSChangelogResolved;
    "snooze:expired": WSSnoozeExpired;
    "license-scan:progress": WSLicenseScanProgress;
    "license-scan:complete": WSLicenseScanComplete;
    "auto-fix:progress": WSAutoFixProgress;
    "auto-fix:complete": WSAutoFixComplete;
    "transitive-resolve:complete": WSTransitiveResolveComplete;
};

export type WSEventType = keyof WSEventMap;
