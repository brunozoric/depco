import { describe, expect, it } from "vitest";
import { compareVersions } from "../versionCompare.js";

describe("compareVersions", () => {
    describe("equal versions", () => {
        it("returns 0 for identical version strings", () => {
            expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
        });

        it("returns 0 for identical multi-segment versions", () => {
            expect(compareVersions("2.3.4", "2.3.4")).toBe(0);
        });
    });

    describe("major version differences", () => {
        it("returns positive when a has a higher major version", () => {
            expect(compareVersions("2.0.0", "1.0.0")).toBeGreaterThan(0);
        });

        it("returns negative when a has a lower major version", () => {
            expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
        });
    });

    describe("minor version differences", () => {
        it("returns positive when a has a higher minor version", () => {
            expect(compareVersions("1.2.0", "1.1.0")).toBeGreaterThan(0);
        });

        it("returns negative when a has a lower minor version", () => {
            expect(compareVersions("1.1.0", "1.2.0")).toBeLessThan(0);
        });
    });

    describe("patch version differences", () => {
        it("returns positive when a has a higher patch version", () => {
            expect(compareVersions("1.0.2", "1.0.1")).toBeGreaterThan(0);
        });

        it("returns negative when a has a lower patch version", () => {
            expect(compareVersions("1.0.1", "1.0.2")).toBeLessThan(0);
        });
    });

    describe("different length version strings", () => {
        it("treats missing segments as 0", () => {
            expect(compareVersions("1.0.0.0", "1.0.0")).toBe(0);
        });

        it("returns positive when extra segment is non-zero", () => {
            expect(compareVersions("1.0.0.1", "1.0.0")).toBeGreaterThan(0);
        });

        it("returns negative when b has a non-zero extra segment", () => {
            expect(compareVersions("1.0.0", "1.0.0.1")).toBeLessThan(0);
        });
    });

    describe("non-numeric parts", () => {
        it("treats non-numeric segments as 0", () => {
            expect(compareVersions("1.abc.0", "1.0.0")).toBe(0);
        });

        it("compares correctly when one side has a non-numeric part", () => {
            expect(compareVersions("1.abc.0", "1.1.0")).toBeLessThan(0);
        });
    });

    describe("sign of return value", () => {
        it("returns a positive number when a > b", () => {
            expect(compareVersions("3.0.0", "1.0.0")).toBeGreaterThan(0);
        });

        it("returns a negative number when a < b", () => {
            expect(compareVersions("1.0.0", "3.0.0")).toBeLessThan(0);
        });

        it("returns exactly 0 when a equals b", () => {
            expect(compareVersions("0.0.0", "0.0.0")).toBe(0);
        });
    });
});
