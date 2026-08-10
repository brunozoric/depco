import { describe, it, expect } from "vitest";
import { computeDedupKey, hashString, mergeMapKey } from "../deduplication.js";

describe("computeDedupKey", () => {
    it("returns the CVE id when present", () => {
        const result = computeDedupKey({
            cveId: "CVE-2024-1234",
            advisoryUrl: "https://example.com/advisory",
            packageName: "pkg",
            title: "Some vulnerability"
        });
        expect(result).toBe("CVE-2024-1234");
    });

    it("hashes the advisory URL when no CVE id", () => {
        const result = computeDedupKey({
            cveId: null,
            advisoryUrl: "https://example.com/advisory",
            packageName: "pkg",
            title: "Some vulnerability"
        });
        expect(result).toBe(hashString("https://example.com/advisory"));
        expect(result).toHaveLength(16);
    });

    it("hashes package name + title as last resort", () => {
        const result = computeDedupKey({
            cveId: null,
            advisoryUrl: null,
            packageName: "lodash",
            title: "Prototype pollution"
        });
        expect(result).toBe(hashString("lodash:Prototype pollution"));
    });

    it("produces deterministic hashes", () => {
        const first = computeDedupKey({
            cveId: null,
            advisoryUrl: "https://example.com/same",
            packageName: "pkg",
            title: "title"
        });
        const second = computeDedupKey({
            cveId: null,
            advisoryUrl: "https://example.com/same",
            packageName: "pkg",
            title: "title"
        });
        expect(first).toBe(second);
    });

    it("produces different hashes for different URLs", () => {
        const first = computeDedupKey({
            cveId: null,
            advisoryUrl: "https://example.com/a",
            packageName: "pkg",
            title: "title"
        });
        const second = computeDedupKey({
            cveId: null,
            advisoryUrl: "https://example.com/b",
            packageName: "pkg",
            title: "title"
        });
        expect(first).not.toBe(second);
    });
});

describe("mergeMapKey", () => {
    it("combines package name and dedup key with separator", () => {
        expect(mergeMapKey({ packageName: "lodash", dedupKey: "CVE-2024-1234" })).toBe(
            "lodash::CVE-2024-1234"
        );
    });
});

describe("hashString", () => {
    it("returns a 16-character hex string", () => {
        const result = hashString("test input");
        expect(result).toHaveLength(16);
        expect(result).toMatch(/^[0-9a-f]+$/);
    });
});
