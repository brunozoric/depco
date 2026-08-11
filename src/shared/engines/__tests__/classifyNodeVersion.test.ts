import { describe, it, expect } from "vitest";
import { classifyNodeVersion } from "../classifyNodeVersion.js";
import { NODE_RELEASES } from "../nodeReleases.js";

describe("classifyNodeVersion", () => {
    it("classifies Node 16 as eol", () => {
        const result = classifyNodeVersion({
            majorVersion: 16,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 7, 1)
        });
        expect(result.status).toBe("eol");
        expect(result.codename).toBe("Gallium");
    });

    it("classifies Node 22 as active-lts when in LTS window", () => {
        const result = classifyNodeVersion({
            majorVersion: 22,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 7, 1)
        });
        expect(result.status).toBe("active-lts");
        expect(result.codename).toBe("Jod");
    });

    it("classifies Node 24 as current when before LTS start", () => {
        const result = classifyNodeVersion({
            majorVersion: 24,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 7, 1)
        });
        expect(result.status).toBe("current");
    });

    it("classifies unknown major version as unknown", () => {
        const result = classifyNodeVersion({
            majorVersion: 999,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 7, 1)
        });
        expect(result.status).toBe("unknown");
        expect(result.eolDate).toBeNull();
    });

    it("classifies node in maintenance window", () => {
        const result = classifyNodeVersion({
            majorVersion: 20,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 7, 1)
        });
        expect(result.status).toBe("maintenance");
    });

    it("returns eolDate for known versions", () => {
        const result = classifyNodeVersion({
            majorVersion: 18,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 7, 1)
        });
        expect(result.eolDate).toBe(Date.UTC(2025, 3, 30));
    });

    it("classifies non-LTS release as current before its maintenance start", () => {
        const result = classifyNodeVersion({
            majorVersion: 23,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 1, 1)
        });
        expect(result.status).toBe("current");
        expect(result.codename).toBeNull();
    });

    it("classifies non-LTS release as maintenance after its maintenance start, before eol", () => {
        const result = classifyNodeVersion({
            majorVersion: 23,
            schedule: NODE_RELEASES,
            now: Date.UTC(2025, 4, 1)
        });
        expect(result.status).toBe("maintenance");
    });

    it("never classifies a non-LTS release as active-lts", () => {
        const result = classifyNodeVersion({
            majorVersion: 21,
            schedule: NODE_RELEASES,
            now: Date.UTC(2024, 2, 1)
        });
        expect(result.status).not.toBe("active-lts");
    });
});
