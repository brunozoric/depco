import { describe, it, expect } from "vitest";
import { computeDedupKey, hashString, mergeMapKey } from "../deduplication.js";

describe("hashString", () => {
    it("returns first 16 chars of SHA256 hex digest", () => {
        const result = hashString("test-input");
        expect(result).toHaveLength(16);
        expect(result).toMatch(/^[a-f0-9]{16}$/);
    });

    it("returns deterministic output for same input", () => {
        expect(hashString("advisory-123")).toBe(hashString("advisory-123"));
    });

    it("returns different output for different input", () => {
        expect(hashString("a")).not.toBe(hashString("b"));
    });
});

describe("computeDedupKey", () => {
    it("prefers CVE ID when present", () => {
        const result = computeDedupKey({
            cveId: "CVE-2024-1234",
            advisoryUrl: "https://example.com/advisory",
            packageName: "foo",
            title: "Some vulnerability"
        });
        expect(result).toBe("CVE-2024-1234");
    });

    it("falls back to hashed advisory URL when no CVE", () => {
        const result = computeDedupKey({
            cveId: null,
            advisoryUrl: "https://example.com/advisory",
            packageName: "foo",
            title: "Some vulnerability"
        });
        expect(result).toBe(hashString("https://example.com/advisory"));
    });

    it("falls back to hashed package+title when no CVE or URL", () => {
        const result = computeDedupKey({
            cveId: null,
            advisoryUrl: null,
            packageName: "foo",
            title: "Some vulnerability"
        });
        expect(result).toBe(hashString("foo:Some vulnerability"));
    });
});

describe("mergeMapKey", () => {
    it("combines package name and dedup key", () => {
        expect(
            mergeMapKey({
                packageName: "lodash",
                dedupKey: "CVE-2024-1234"
            })
        ).toBe("lodash::CVE-2024-1234");
    });
});
