import { describe, it, expect } from "vitest";
import { NpmReadmeResolver } from "../resolvers/NpmReadmeResolver.js";
import type { RegistryCacheService } from "../../RegistryCache/index.js";

function createRegistryCacheService(readme: string | null): RegistryCacheService.Interface {
    return {
        getPackageInfo: async () => ({
            name: "some-package",
            latestVersion: "2.0.0",
            distTags: {},
            versions: ["1.0.0", "2.0.0"],
            time: {},
            repoUrl: null,
            repoDirectory: null,
            readme,
            license: null
        }),
        clearAll: async () => {},
        clearPackage: async () => {}
    };
}

describe("NpmReadmeResolver", () => {
    it("returns an empty map when the readme is null", async () => {
        const resolver = new NpmReadmeResolver(createRegistryCacheService(null));

        const result = await resolver.resolve("some-package", null, ["1.0.0"]);

        expect(result.size).toBe(0);
    });

    it("parses version sections from readme content", async () => {
        const readme = [
            "# some-package",
            "",
            "## Changelog",
            "",
            "## 2.0.0",
            "- breaking change",
            "",
            "## 1.0.0",
            "- initial release"
        ].join("\n");

        const resolver = new NpmReadmeResolver(createRegistryCacheService(readme));

        const result = await resolver.resolve("some-package", null, ["1.0.0", "2.0.0"]);

        expect(result.size).toBe(2);
        expect(result.get("2.0.0")).toBe("- breaking change");
        expect(result.get("1.0.0")).toBe("- initial release");
    });

    it("returns an empty map when no version headings are found", async () => {
        const readme = "# some-package\n\nJust a description, no changelog here.";

        const resolver = new NpmReadmeResolver(createRegistryCacheService(readme));

        const result = await resolver.resolve("some-package", null, ["1.0.0"]);

        expect(result.size).toBe(0);
    });

    it("returns an empty map when getPackageInfo throws", async () => {
        const resolver = new NpmReadmeResolver({
            getPackageInfo: async () => {
                throw new Error("registry unreachable");
            },
            clearAll: async () => {},
            clearPackage: async () => {}
        });

        const result = await resolver.resolve("some-package", null, ["1.0.0"]);

        expect(result.size).toBe(0);
    });
});
