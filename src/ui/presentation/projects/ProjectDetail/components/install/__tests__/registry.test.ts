import { describe, it, expect } from "vitest";
import { INSTALL_OPTIONS_COMPONENTS } from "../registry.js";

describe("INSTALL_OPTIONS_COMPONENTS registry", () => {
    it("has entries for all four package managers", () => {
        expect(Object.keys(INSTALL_OPTIONS_COMPONENTS).sort()).toEqual([
            "bun",
            "npm",
            "pnpm",
            "yarn"
        ]);
    });

    it("npm entry is a function (React component)", () => {
        expect(typeof INSTALL_OPTIONS_COMPONENTS.npm).toBe("function");
    });

    it("yarn entry is a function (React component)", () => {
        expect(typeof INSTALL_OPTIONS_COMPONENTS.yarn).toBe("function");
    });

    it("pnpm entry is a function (React component)", () => {
        expect(typeof INSTALL_OPTIONS_COMPONENTS.pnpm).toBe("function");
    });

    it("bun entry is a function (React component)", () => {
        expect(typeof INSTALL_OPTIONS_COMPONENTS.bun).toBe("function");
    });

    it("each entry is a distinct component", () => {
        const components = Object.values(INSTALL_OPTIONS_COMPONENTS);
        const unique = new Set(components);
        expect(unique.size).toBe(4);
    });
});
