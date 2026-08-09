import { describe, it, expect } from "vitest";
import { compareVersions } from "../ChangelogService.js";

describe("compareVersions", () => {
    it("returns 0 for equal versions", () => {
        expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    });

    it("returns positive when first has greater major", () => {
        expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
    });

    it("returns positive when first has greater minor", () => {
        expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
    });

    it("returns positive when first has greater patch", () => {
        expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
    });

    it("returns negative when first is lesser", () => {
        expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
    });

    it("handles different length versions", () => {
        expect(compareVersions("1.0", "1.0.0")).toBe(0);
        expect(compareVersions("1.0.1", "1.0")).toBeGreaterThan(0);
    });

    it("treats non-numeric segment prefix as 0", () => {
        expect(compareVersions("1.0.0-rc", "1.0.0")).toBe(0);
    });

    it("treats dot-separated prerelease suffix as extra segment", () => {
        expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBeGreaterThan(0);
    });
});
