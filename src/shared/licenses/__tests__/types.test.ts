import { describe, it, expect } from "vitest";
import {
    classifyLicenseRiskTier,
    RISK_TIER_VALUES,
    LICENSE_RISK_TIERS
} from "#shared/licenses/types.js";

describe("classifyLicenseRiskTier()", () => {
    it("should classify MIT as permissive", () => {
        expect(classifyLicenseRiskTier("MIT")).toBe("permissive");
    });

    it("should classify Apache-2.0 as permissive", () => {
        expect(classifyLicenseRiskTier("Apache-2.0")).toBe("permissive");
    });

    it("should classify ISC as permissive", () => {
        expect(classifyLicenseRiskTier("ISC")).toBe("permissive");
    });

    it("should classify BSD-2-Clause as permissive", () => {
        expect(classifyLicenseRiskTier("BSD-2-Clause")).toBe("permissive");
    });

    it("should classify BSD-3-Clause as permissive", () => {
        expect(classifyLicenseRiskTier("BSD-3-Clause")).toBe("permissive");
    });

    it("should classify 0BSD as permissive", () => {
        expect(classifyLicenseRiskTier("0BSD")).toBe("permissive");
    });

    it("should classify Unlicense as permissive", () => {
        expect(classifyLicenseRiskTier("Unlicense")).toBe("permissive");
    });

    it("should classify CC0-1.0 as permissive", () => {
        expect(classifyLicenseRiskTier("CC0-1.0")).toBe("permissive");
    });

    it("should classify LGPL-2.1 as weak-copyleft", () => {
        expect(classifyLicenseRiskTier("LGPL-2.1")).toBe("weak-copyleft");
    });

    it("should classify LGPL-3.0 as weak-copyleft", () => {
        expect(classifyLicenseRiskTier("LGPL-3.0")).toBe("weak-copyleft");
    });

    it("should classify MPL-2.0 as weak-copyleft", () => {
        expect(classifyLicenseRiskTier("MPL-2.0")).toBe("weak-copyleft");
    });

    it("should classify EPL-1.0 as weak-copyleft", () => {
        expect(classifyLicenseRiskTier("EPL-1.0")).toBe("weak-copyleft");
    });

    it("should classify EPL-2.0 as weak-copyleft", () => {
        expect(classifyLicenseRiskTier("EPL-2.0")).toBe("weak-copyleft");
    });

    it("should classify GPL-2.0 as copyleft", () => {
        expect(classifyLicenseRiskTier("GPL-2.0")).toBe("copyleft");
    });

    it("should classify GPL-3.0 as copyleft", () => {
        expect(classifyLicenseRiskTier("GPL-3.0")).toBe("copyleft");
    });

    it("should classify AGPL-3.0 as copyleft", () => {
        expect(classifyLicenseRiskTier("AGPL-3.0")).toBe("copyleft");
    });

    it("should classify UNLICENSED as proprietary", () => {
        expect(classifyLicenseRiskTier("UNLICENSED")).toBe("proprietary");
    });

    it("should classify null as unknown", () => {
        expect(classifyLicenseRiskTier(null)).toBe("unknown");
    });

    it("should classify unrecognized SPDX id as unknown", () => {
        expect(classifyLicenseRiskTier("SomeCustomLicense")).toBe("unknown");
    });

    it("should classify empty string as unknown", () => {
        expect(classifyLicenseRiskTier("")).toBe("unknown");
    });
});

describe("RISK_TIER_VALUES", () => {
    it("should contain all five risk tiers", () => {
        expect(RISK_TIER_VALUES).toEqual([
            "permissive",
            "weak-copyleft",
            "copyleft",
            "proprietary",
            "unknown"
        ]);
    });
});

describe("LICENSE_RISK_TIERS", () => {
    it("should map GPL-3.0 to copyleft", () => {
        expect(LICENSE_RISK_TIERS["GPL-3.0"]).toBe("copyleft");
    });

    it("should map LGPL-2.1 to weak-copyleft", () => {
        expect(LICENSE_RISK_TIERS["LGPL-2.1"]).toBe("weak-copyleft");
    });
});

describe("spdx-license-list fallback", () => {
    it("should classify BlueOak-1.0.0 as permissive via OSI-approved", () => {
        expect(classifyLicenseRiskTier("BlueOak-1.0.0")).toBe("permissive");
    });

    it("should classify MIT-0 as permissive via OSI-approved", () => {
        expect(classifyLicenseRiskTier("MIT-0")).toBe("permissive");
    });

    it("should classify compound OR expression using most permissive", () => {
        expect(classifyLicenseRiskTier("(MIT OR GPL-3.0)")).toBe("permissive");
    });

    it("should classify compound AND expression using most restrictive", () => {
        expect(classifyLicenseRiskTier("(CC-BY-4.0 AND GPL-3.0)")).toBe("copyleft");
    });
});
