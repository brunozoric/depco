import { describe, it, expect } from "vitest";
import { SpdxFormatter } from "../formatters/SpdxFormatter.js";
import type { SbomService } from "../abstractions/SbomService.js";

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
        vulnerabilities: [],
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

describe("SpdxFormatter", () => {
    const formatter = new SpdxFormatter();

    it("produces valid SPDX 2.3 structure", () => {
        const result = formatter.format(createTestData());

        expect(result.mediaType).toBe("application/json");
        expect(result.filename).toBe("my-app-spdx.json");

        const content = result.content as Record<string, unknown>;
        expect(content["spdxVersion"]).toBe("SPDX-2.3");
        expect(content["dataLicense"]).toBe("CC0-1.0");
        expect(content["SPDXID"]).toBe("SPDXRef-DOCUMENT");
        expect(content["name"]).toBe("my-app");
        expect(content["documentNamespace"] as string).toMatch(/^https:\/\/spdx\.org\/spdxdocs\//);
    });

    it("includes packages with SPDX IDs and license info", () => {
        const result = formatter.format(createTestData());
        const content = result.content as Record<string, unknown>;
        const packages = content["packages"] as Array<Record<string, unknown>>;

        expect(packages).toHaveLength(1);
        expect(packages[0]!["name"]).toBe("lodash");
        expect(packages[0]!["versionInfo"]).toBe("4.17.21");
        expect(packages[0]!["licenseConcluded"]).toBe("MIT");
        expect(packages[0]!["filesAnalyzed"]).toBe(false);
        expect(packages[0]!["SPDXID"]).toMatch(/^SPDXRef-Package-/);
    });

    it("includes DESCRIBES and DEPENDS_ON relationships", () => {
        const result = formatter.format(createTestData());
        const content = result.content as Record<string, unknown>;
        const relationships = content["relationships"] as Array<Record<string, unknown>>;

        const describes = relationships.filter(r => r["relationshipType"] === "DESCRIBES");
        expect(describes.length).toBeGreaterThanOrEqual(1);

        const dependsOn = relationships.filter(r => r["relationshipType"] === "DEPENDS_ON");
        expect(dependsOn.length).toBeGreaterThanOrEqual(0);
    });

    it("does not include vulnerabilities section", () => {
        const result = formatter.format(
            createTestData({
                vulnerabilities: [
                    {
                        advisoryId: "CVE-2021-1234",
                        severity: "high",
                        packageName: "lodash",
                        source: "osv",
                        advisoryUrl: null
                    }
                ]
            })
        );

        const content = result.content as Record<string, unknown>;
        expect(content).not.toHaveProperty("vulnerabilities");
    });

    it("uses NOASSERTION when spdxId is null", () => {
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
        const packages = content["packages"] as Array<Record<string, unknown>>;
        expect(packages[0]!["licenseConcluded"]).toBe("NOASSERTION");
    });

    it("sanitizes unsafe characters in filename", () => {
        const result = formatter.format(createTestData({ projectName: "my:app\ntest" }));
        expect(result.filename).toBe("my-app-test-spdx.json");
    });

    it("produces distinct SPDX IDs for scoped packages", () => {
        const result = formatter.format(
            createTestData({
                components: [
                    {
                        packageName: "@webiny/stdlib",
                        version: "1.0.0",
                        spdxId: "MIT",
                        licenseName: "MIT",
                        type: "dependency"
                    },
                    {
                        packageName: "@other/stdlib",
                        version: "1.0.0",
                        spdxId: "MIT",
                        licenseName: "MIT",
                        type: "dependency"
                    }
                ]
            })
        );
        const content = result.content as Record<string, unknown>;
        const packages = content["packages"] as Array<Record<string, unknown>>;
        const ids = packages.map(p => p["SPDXID"]);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
