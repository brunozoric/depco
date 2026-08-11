import type { IClassifyNodeVersionInput, IEngineClassification } from "./types.js";

export function classifyNodeVersion(input: IClassifyNodeVersionInput): IEngineClassification {
    const { majorVersion, schedule, now = Date.now() } = input;
    const release = schedule.find(candidate => candidate.version === majorVersion);

    if (!release) {
        return { status: "unknown", eolDate: null, codename: null };
    }

    if (now >= release.eolDate) {
        return { status: "eol", eolDate: release.eolDate, codename: release.codename };
    }

    if (release.maintenanceStart !== null && now >= release.maintenanceStart) {
        return { status: "maintenance", eolDate: release.eolDate, codename: release.codename };
    }

    if (release.ltsStart !== null && now >= release.ltsStart) {
        return { status: "active-lts", eolDate: release.eolDate, codename: release.codename };
    }

    return { status: "current", eolDate: release.eolDate, codename: release.codename };
}
