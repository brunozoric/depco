import { describe, it, expect } from "vitest";
import { classifyUpgrade } from "#shared/versions/types.js";

describe("classifyUpgrade()", () => {
    it("classifies a same version as none", () => {
        expect(classifyUpgrade({ currentVersion: "1.0.0", latestVersion: "1.0.0" })).toBe("none");
    });

    it("classifies a patch bump as patch", () => {
        expect(classifyUpgrade({ currentVersion: "1.0.0", latestVersion: "1.0.1" })).toBe("patch");
    });

    it("classifies a minor bump as minor", () => {
        expect(classifyUpgrade({ currentVersion: "1.0.0", latestVersion: "1.1.0" })).toBe("minor");
    });

    it("classifies a major bump as major", () => {
        expect(classifyUpgrade({ currentVersion: "1.0.0", latestVersion: "2.0.0" })).toBe("major");
    });

    it("classifies a premajor bump as major", () => {
        expect(classifyUpgrade({ currentVersion: "1.0.0", latestVersion: "2.0.0-beta.0" })).toBe(
            "major"
        );
    });

    it("classifies a preminor bump as minor", () => {
        expect(classifyUpgrade({ currentVersion: "1.0.0", latestVersion: "1.1.0-beta.0" })).toBe(
            "minor"
        );
    });

    it("classifies a downgrade as none", () => {
        expect(classifyUpgrade({ currentVersion: "1.1.0", latestVersion: "1.0.0" })).toBe("none");
    });

    it("classifies an invalid latest version as none", () => {
        expect(classifyUpgrade({ currentVersion: "1.0.0", latestVersion: "not-a-version" })).toBe(
            "none"
        );
    });
});
