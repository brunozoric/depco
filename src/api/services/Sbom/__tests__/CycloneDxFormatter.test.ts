import { describe, it, expect } from "vitest";
import { CycloneDxFormatter } from "../CycloneDxFormatter.js";
import type { SbomService } from "../../abstractions/SbomService.js";

function createTestData(overrides?: Partial<SbomService.ProjectData>): SbomService.ProjectData {
    return {
        projectName: "my-app",
        projectPath: "/projects/my-app",
        packageManager: "yarn",
        components: [
            {
                packageName: "lodash",
                version: "4.17.21",
                spdxId: "MIT",
                licenseName: "MIT",
                type: "dependency"
            }
        ],
        vulnerabilities: [
            {
                advisoryId: "CVE-2021-1234",
                severity: "high",
                packageName: "lodash",
                source: "osv",
                advisoryUrl: "https://osv.dev/CVE-2021-1234"
            }
        ],
        edges: [
            {
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash",
                childVersion: "4.17.21"
            }
        ],
        ...overrides
    };
}

describe("CycloneDxFormatter", () => {
    const formatter = new CycloneDxFormatter();

    it("produces valid CycloneDX 1.5 structure", () => {
        const result = formatter.format(createTestData());

        expect(result.mediaType).toBe("application/json");
        expect(result.filename).toBe("my-app-cyclonedx.json");

        const content = result.content as Record<string, unknown>;
        expect(content["bomFormat"]).toBe("CycloneDX");
        expect(content["specVersion"]).toBe("1.5");
        expect(content["serialNumber"]).toMatch(/^urn:uuid:/);
    });

    it("includes components with purl and license", () => {
        const result = formatter.format(createTestData());
        const content = result.content as Record<string, unknown>;
        const components = content["components"] as Array<Record<string, unknown>>;

        expect(components).toHaveLength(1);
        expect(components[0]!["name"]).toBe("lodash");
        expect(components[0]!["version"]).toBe("4.17.21");
        expect(components[0]!["purl"]).toBe("pkg:npm/lodash@4.17.21");
        expect(components[0]!["type"]).toBe("library");

        const componentLicenses = components[0]!["licenses"] as Array<Record<string, unknown>>;
        expect(componentLicenses).toHaveLength(1);
    });

    it("includes vulnerabilities with affects references", () => {
        const result = formatter.format(createTestData());
        const content = result.content as Record<string, unknown>;
        const vulnerabilityList = content["vulnerabilities"] as Array<Record<string, unknown>>;

        expect(vulnerabilityList).toHaveLength(1);
        expect(vulnerabilityList[0]!["id"]).toBe("CVE-2021-1234");
    });

    it("includes dependencies from edges", () => {
        const result = formatter.format(createTestData());
        const content = result.content as Record<string, unknown>;
        const dependencyList = content["dependencies"] as Array<Record<string, unknown>>;

        expect(dependencyList.length).toBeGreaterThanOrEqual(1);
    });

    it("handles empty data gracefully", () => {
        const result = formatter.format(
            createTestData({
                components: [],
                vulnerabilities: [],
                edges: []
            })
        );

        const content = result.content as Record<string, unknown>;
        expect(content["components"]).toEqual([]);
        expect(content["vulnerabilities"]).toEqual([]);
    });

    it("sanitizes unsafe characters in filename", () => {
        const result = formatter.format(createTestData({ projectName: 'my/app"bad' }));
        expect(result.filename).toBe("my-app-bad-cyclonedx.json");
    });

    it("omits license block when spdxId is null", () => {
        const result = formatter.format(
            createTestData({
                components: [
                    {
                        packageName: "unknown-pkg",
                        version: "1.0.0",
                        spdxId: null,
                        licenseName: null,
                        type: "dependency"
                    }
                ]
            })
        );
        const content = result.content as Record<string, unknown>;
        const components = content["components"] as Array<Record<string, unknown>>;
        expect(components[0]!["licenses"]).toEqual([]);
    });
});
