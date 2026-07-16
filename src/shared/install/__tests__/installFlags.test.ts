import { describe, it, expect } from "vitest";
import { INSTALL_FLAG_REGISTRY } from "../index.js";

describe("INSTALL_FLAG_REGISTRY", () => {
    it("has entries for all package managers", () => {
        expect(INSTALL_FLAG_REGISTRY.yarn.length).toBeGreaterThan(0);
        expect(INSTALL_FLAG_REGISTRY.npm.length).toBeGreaterThan(0);
        expect(INSTALL_FLAG_REGISTRY.pnpm.length).toBeGreaterThan(0);
        expect(INSTALL_FLAG_REGISTRY.bun.length).toBeGreaterThan(0);
    });

    it("has no duplicate flags per PM", () => {
        for (const [, flags] of Object.entries(INSTALL_FLAG_REGISTRY)) {
            const flagNames = flags.map(f => f.flag);
            expect(new Set(flagNames).size).toBe(flagNames.length);
        }
    });

    it("every flag has a defaultEnabled boolean", () => {
        for (const flags of Object.values(INSTALL_FLAG_REGISTRY)) {
            for (const flag of flags) {
                expect(typeof flag.defaultEnabled).toBe("boolean");
            }
        }
    });

    it("pnpm flags match known set", () => {
        const flags = INSTALL_FLAG_REGISTRY.pnpm.map(f => f.flag);
        expect(flags).toContain("--frozen-lockfile");
        expect(flags).toContain("--prod");
        expect(flags).toContain("--force");
        expect(flags).toContain("--ignore-scripts");
    });
});
