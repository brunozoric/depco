import type { VulnerabilitySeverity } from "./types.js";

/**
 * Maps a numeric CVSS base score (0-10) to our internal severity bucket.
 */
export function mapCvssScoreToSeverity(score: number): VulnerabilitySeverity {
    if (score >= 9.0) {
        return "critical";
    }
    if (score >= 7.0) {
        return "high";
    }
    if (score >= 4.0) {
        return "moderate";
    }
    if (score >= 0.1) {
        return "low";
    }
    return "info";
}
