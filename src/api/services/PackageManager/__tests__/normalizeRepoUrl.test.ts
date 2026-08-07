import { describe, it, expect } from "vitest";
import { normalizeRepoUrl, extractRepoDirectory } from "../normalizeRepoUrl.js";

describe("normalizeRepoUrl", () => {
    it("normalizes a GitHub HTTPS URL string", () => {
        expect(normalizeRepoUrl("https://github.com/facebook/react")).toBe(
            "https://github.com/facebook/react"
        );
    });

    it("strips git+ prefix", () => {
        expect(normalizeRepoUrl("git+https://github.com/facebook/react")).toBe(
            "https://github.com/facebook/react"
        );
    });

    it("strips .git suffix", () => {
        expect(normalizeRepoUrl("https://github.com/facebook/react.git")).toBe(
            "https://github.com/facebook/react"
        );
    });

    it("converts ssh://git@github.com to HTTPS", () => {
        expect(normalizeRepoUrl("ssh://git@github.com/facebook/react")).toBe(
            "https://github.com/facebook/react"
        );
    });

    it("normalizes git@github.com: SSH shorthand", () => {
        expect(normalizeRepoUrl("git@github.com:facebook/react")).toBe(
            "https://github.com/facebook/react"
        );
    });

    it("extracts URL from object with url property", () => {
        expect(normalizeRepoUrl({ url: "https://github.com/facebook/react.git" })).toBe(
            "https://github.com/facebook/react"
        );
    });

    it("returns null for non-GitHub URL", () => {
        expect(normalizeRepoUrl("https://gitlab.com/owner/repo")).toBeNull();
    });

    it("returns null for null input", () => {
        expect(normalizeRepoUrl(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
        expect(normalizeRepoUrl(undefined)).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(normalizeRepoUrl("")).toBeNull();
    });

    it("returns null for object without url property", () => {
        expect(normalizeRepoUrl({ type: "git" })).toBeNull();
    });
});

describe("extractRepoDirectory", () => {
    it("returns directory from object", () => {
        expect(extractRepoDirectory({ directory: "packages/core" })).toBe("packages/core");
    });

    it("returns null when object has no directory", () => {
        expect(extractRepoDirectory({ url: "https://github.com/o/r" })).toBeNull();
    });

    it("returns null for empty string directory", () => {
        expect(extractRepoDirectory({ directory: "" })).toBeNull();
    });

    it("returns null for string input", () => {
        expect(extractRepoDirectory("https://github.com/o/r")).toBeNull();
    });

    it("returns null for null", () => {
        expect(extractRepoDirectory(null)).toBeNull();
    });

    it("returns null for undefined", () => {
        expect(extractRepoDirectory(undefined)).toBeNull();
    });
});
