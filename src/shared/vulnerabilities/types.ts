export const VULNERABILITY_SEVERITIES = ["critical", "high", "moderate", "low", "info"] as const;

export type VulnerabilitySeverity = (typeof VULNERABILITY_SEVERITIES)[number];

export const VULNERABILITY_PENALTY: Record<Exclude<VulnerabilitySeverity, "info">, number> = {
    critical: 10,
    high: 5,
    moderate: 2,
    low: 1
};

export interface VulnerabilitySeverityCounts extends Record<VulnerabilitySeverity, number> {}

export function computeVulnerabilityPenalty(counts: VulnerabilitySeverityCounts): number {
    return (
        counts.critical * VULNERABILITY_PENALTY.critical +
        counts.high * VULNERABILITY_PENALTY.high +
        counts.moderate * VULNERABILITY_PENALTY.moderate +
        counts.low * VULNERABILITY_PENALTY.low
    );
}
