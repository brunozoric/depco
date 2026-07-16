import { describe, it, expect } from "vitest";
import { parseDuration } from "#shared/security/index.js";

describe("parseDuration", () => {
    it("parses days to seconds", () => {
        expect(parseDuration("3d")).toBe(259200);
        expect(parseDuration("1d")).toBe(86400);
    });

    it("parses hours to seconds", () => {
        expect(parseDuration("72h")).toBe(259200);
        expect(parseDuration("1h")).toBe(3600);
    });

    it("parses minutes to seconds", () => {
        expect(parseDuration("60m")).toBe(3600);
        expect(parseDuration("1m")).toBe(60);
    });

    it("parses seconds", () => {
        expect(parseDuration("30s")).toBe(30);
        expect(parseDuration("1s")).toBe(1);
    });

    it("handles zero", () => {
        expect(parseDuration("0d")).toBe(0);
        expect(parseDuration("0h")).toBe(0);
    });

    it("throws on invalid format", () => {
        expect(() => parseDuration("abc")).toThrow('Invalid duration: "abc"');
        expect(() => parseDuration("3x")).toThrow('Invalid duration: "3x"');
        expect(() => parseDuration("")).toThrow('Invalid duration: ""');
        expect(() => parseDuration("d3")).toThrow('Invalid duration: "d3"');
    });
});
