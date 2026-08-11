import { describe, it, expect } from "vitest";
import { parseEnginesNode } from "../parseEnginesNode.js";

describe("parseEnginesNode", () => {
    it("extracts minimum major from >=18.0.0", () => {
        expect(parseEnginesNode(">=18.0.0")).toBe(18);
    });

    it("extracts minimum major from ^20.0.0", () => {
        expect(parseEnginesNode("^20.0.0")).toBe(20);
    });

    it("extracts minimum major from ~22.1.0", () => {
        expect(parseEnginesNode("~22.1.0")).toBe(22);
    });

    it("extracts minimum major from bare version 18", () => {
        expect(parseEnginesNode("18")).toBe(18);
    });

    it("extracts minimum major from range >=16 <20", () => {
        expect(parseEnginesNode(">=16 <20")).toBe(16);
    });

    it("extracts minimum major from OR range >=18 || >=20", () => {
        expect(parseEnginesNode(">=18 || >=20")).toBe(18);
    });

    it("returns null for wildcard *", () => {
        expect(parseEnginesNode("*")).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(parseEnginesNode("")).toBeNull();
    });

    it("returns null for unparsable value", () => {
        expect(parseEnginesNode("not-a-version")).toBeNull();
    });
});
