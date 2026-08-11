import { describe, it, expect } from "vitest";
import { depcoConfigSchema } from "../schema.js";

describe("depcoConfigSchema", () => {
    it("accepts empty config", () => {
        const result = depcoConfigSchema.parse({});
        expect(result).toEqual({});
    });

    it("accepts full config", () => {
        const result = depcoConfigSchema.parse({
            scan: {
                license: {
                    allowedRiskTiers: ["permissive", "weak-copyleft"],
                    ignoredPackages: ["some-pkg"]
                },
                vulnerability: {
                    maxSeverity: "moderate",
                    ignoredPackages: ["old-pkg"]
                },
                ignoredPackages: ["internal"],
                registryUrl: "https://custom.registry.com"
            }
        });
        expect(result.scan?.license?.allowedRiskTiers).toEqual(["permissive", "weak-copyleft"]);
        expect(result.scan?.vulnerability?.maxSeverity).toBe("moderate");
    });

    it("accepts config with scan.engines", () => {
        const result = depcoConfigSchema.parse({
            scan: {
                engines: {
                    ignore: ["legacy-pkg"],
                    warnMaintenance: true
                }
            }
        });
        expect(result.scan?.engines?.ignore).toEqual(["legacy-pkg"]);
        expect(result.scan?.engines?.warnMaintenance).toBe(true);
    });

    it("accepts config with only scan.license", () => {
        const result = depcoConfigSchema.parse({
            scan: { license: { allowedRiskTiers: ["permissive"] } }
        });
        expect(result.scan?.license?.allowedRiskTiers).toEqual(["permissive"]);
    });

    it("rejects invalid risk tier", () => {
        expect(() =>
            depcoConfigSchema.parse({
                scan: { license: { allowedRiskTiers: ["invalid-tier"] } }
            })
        ).toThrow();
    });

    it("rejects invalid severity", () => {
        expect(() =>
            depcoConfigSchema.parse({
                scan: { vulnerability: { maxSeverity: "invalid" } }
            })
        ).toThrow();
    });

    it("rejects invalid registry URL", () => {
        expect(() =>
            depcoConfigSchema.parse({
                scan: { registryUrl: "not-a-url" }
            })
        ).toThrow();
    });
});
