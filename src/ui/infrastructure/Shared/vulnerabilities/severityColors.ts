import type { VulnerabilitySeverity } from "#shared/vulnerabilities/types.js";

export const SEVERITY_COLORS: Record<VulnerabilitySeverity, string> = {
    critical: "red",
    high: "orange",
    moderate: "yellow",
    low: "blue",
    info: "gray"
};
