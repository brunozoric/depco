import { describe, it, expect } from "vitest";
import { SbomFormatterRegistry } from "../SbomFormatterRegistry.js";
import { SbomFormatterRegistry as SbomFormatterRegistryAbstraction } from "../abstractions/SbomFormatterRegistry.js";
import { createContainer } from "#shared/di/index.js";
import { CycloneDxFormatter } from "../formatters/CycloneDxFormatter.js";
import { SpdxFormatter } from "../formatters/SpdxFormatter.js";

describe("SbomFormatterRegistry", () => {
    const container = createContainer();
    container.register(CycloneDxFormatter);
    container.register(SpdxFormatter);
    container.register(SbomFormatterRegistry);

    it("returns CycloneDX formatter for 'cyclonedx'", () => {
        const registry = container.resolve(SbomFormatterRegistryAbstraction);
        const formatter = registry.get("cyclonedx");
        expect(formatter).toBeDefined();
    });

    it("returns SPDX formatter for 'spdx'", () => {
        const registry = container.resolve(SbomFormatterRegistryAbstraction);
        const formatter = registry.get("spdx");
        expect(formatter).toBeDefined();
    });

    it("throws for unknown format", () => {
        const registry = container.resolve(SbomFormatterRegistryAbstraction);
        expect(() => registry.get("unknown")).toThrow("Unknown SBOM format: unknown");
    });
});
