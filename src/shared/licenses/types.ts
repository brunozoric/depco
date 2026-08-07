import spdxLicenseList from "spdx-license-list";

function normalizeSpdxId(value: unknown): string | null {
    if (!value) {
        return null;
    }
    if (typeof value === "object") {
        return normalizeSpdxId((value as { type?: string }).type);
    }
    return String(value).trim() || null;
}

export const RISK_TIER_VALUES = [
    "permissive",
    "weak-copyleft",
    "copyleft",
    "proprietary",
    "unknown"
] as const;

export type LicenseRiskTier = (typeof RISK_TIER_VALUES)[number];

export const LICENSE_RISK_TIERS: Record<string, LicenseRiskTier> = {
    "CC0-1.0": "permissive",
    Unlicense: "permissive",
    WTFPL: "permissive",
    BSD: "permissive",
    "LGPL-2.0": "weak-copyleft",
    "LGPL-2.0-only": "weak-copyleft",
    "LGPL-2.1": "weak-copyleft",
    "LGPL-2.1-only": "weak-copyleft",
    "LGPL-2.1-or-later": "weak-copyleft",
    "LGPL-3.0": "weak-copyleft",
    "LGPL-3.0-only": "weak-copyleft",
    "LGPL-3.0-or-later": "weak-copyleft",
    "MPL-2.0": "weak-copyleft",
    "EPL-1.0": "weak-copyleft",
    "EPL-2.0": "weak-copyleft",
    "CDDL-1.0": "weak-copyleft",
    "CDDL-1.1": "weak-copyleft",
    "CPL-1.0": "weak-copyleft",
    "GPL-2.0": "copyleft",
    "GPL-2.0-only": "copyleft",
    "GPL-2.0-or-later": "copyleft",
    "GPL-3.0": "copyleft",
    "GPL-3.0-only": "copyleft",
    "GPL-3.0-or-later": "copyleft",
    "AGPL-1.0-only": "copyleft",
    "AGPL-3.0": "copyleft",
    "AGPL-3.0-only": "copyleft",
    "AGPL-3.0-or-later": "copyleft",
    "SSPL-1.0": "copyleft",
    "CC-BY-SA-4.0": "copyleft",
    "CC-BY-NC-4.0": "proprietary",
    "CC-BY-NC-SA-4.0": "proprietary",
    "CC-BY-NC-ND-4.0": "proprietary"
};

export const LICENSE_POLICY_ACTIONS = ["allow", "warn", "deny"] as const;

export type LicensePolicyAction = (typeof LICENSE_POLICY_ACTIONS)[number];

const RISK_TIER_PRIORITY: Record<LicenseRiskTier, number> = {
    permissive: 0,
    "weak-copyleft": 1,
    copyleft: 2,
    proprietary: 3,
    unknown: 4
};

function classifySingle(spdxId: string): LicenseRiskTier {
    const explicit = LICENSE_RISK_TIERS[spdxId];
    if (explicit) {
        return explicit;
    }

    const spdxEntry = spdxLicenseList[spdxId as keyof typeof spdxLicenseList];
    if (spdxEntry && spdxEntry.osiApproved) {
        return "permissive";
    }

    return "unknown";
}

export function classifyLicenseRiskTier(rawSpdxId: string | null | unknown): LicenseRiskTier {
    const spdxId = normalizeSpdxId(rawSpdxId);

    if (!spdxId) {
        return "unknown";
    } else if (spdxId === "UNLICENSED") {
        return "proprietary";
    }

    const direct = classifySingle(spdxId);
    if (direct !== "unknown") {
        return direct;
    }
    const components = spdxId
        .replace(/[()]/g, "")
        .split(/\s+(?:OR|AND)\s+/i)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (components.length <= 1) {
        return "unknown";
    }

    const tiers = components.map(component => classifySingle(component));
    const knownTiers = tiers.filter(tier => tier !== "unknown");

    if (knownTiers.length === 0) {
        return "unknown";
    }

    if (spdxId.includes(" OR ")) {
        return knownTiers.reduce((best, tier) =>
            RISK_TIER_PRIORITY[tier] < RISK_TIER_PRIORITY[best] ? tier : best
        );
    }

    return knownTiers.reduce((worst, tier) =>
        RISK_TIER_PRIORITY[tier] > RISK_TIER_PRIORITY[worst] ? tier : worst
    );
}
