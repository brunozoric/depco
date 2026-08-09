import type { LicenseRiskTier } from "#shared/licenses/types.js";

export const RISK_TIER_COLORS: Record<LicenseRiskTier, string> = {
    permissive: "green",
    "weak-copyleft": "yellow",
    copyleft: "orange",
    proprietary: "red",
    unknown: "gray"
};
