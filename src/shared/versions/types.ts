import semver from "semver";

export const UPGRADE_TYPE_VALUES = ["patch", "minor", "major", "none"] as const;

export type UpgradeType = (typeof UPGRADE_TYPE_VALUES)[number];

export interface IClassifyUpgradeInput {
    currentVersion: string;
    latestVersion: string;
}

export function classifyUpgrade(input: IClassifyUpgradeInput): UpgradeType {
    const { currentVersion, latestVersion } = input;

    if (currentVersion === latestVersion) {
        return "none";
    }

    if (!semver.valid(currentVersion) || !semver.valid(latestVersion)) {
        return "none";
    }

    const diff = semver.diff(currentVersion, latestVersion);
    if (!diff || !semver.gt(latestVersion, currentVersion)) {
        return "none";
    }

    if (diff === "major" || diff === "premajor") {
        return "major";
    }
    if (diff === "minor" || diff === "preminor") {
        return "minor";
    }
    return "patch";
}
