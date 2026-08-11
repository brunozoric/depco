import { describe, it, expect } from "vitest";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { SbomFormatterRegistry } from "../abstractions/SbomFormatterRegistry.js";

describe("SbomFormatterRegistry", () => {
    const { container } = createTestApiContainer();

    it("returns CycloneDX formatter for 'cyclonedx'", () => {
        const registry = container.resolve(SbomFormatterRegistry);
        const formatter = registry.get("cyclonedx");
        expect(formatter).toBeDefined();
    });

    it("returns SPDX formatter for 'spdx'", () => {
        const registry = container.resolve(SbomFormatterRegistry);
        const formatter = registry.get("spdx");
        expect(formatter).toBeDefined();
    });

    it("throws for unknown format", () => {
        const registry = container.resolve(SbomFormatterRegistry);
        expect(() => registry.get("unknown")).toThrow("Unknown SBOM format: unknown");
    });
});
