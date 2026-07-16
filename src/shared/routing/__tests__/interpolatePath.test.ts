import { describe, it, expect } from "vitest";
import { interpolatePath } from "../interpolatePath.js";

describe("interpolatePath", () => {
    it("replaces single param", () => {
        expect(interpolatePath("/api/projects/:id", { id: "p1" })).toBe("/api/projects/p1");
    });

    it("replaces multiple params", () => {
        expect(interpolatePath("/api/projects/:id/jobs/:jobId", { id: "p1", jobId: "j1" })).toBe(
            "/api/projects/p1/jobs/j1"
        );
    });

    it("URL-encodes param values", () => {
        expect(interpolatePath("/api/cache/:packageName", { packageName: "@scope/pkg" })).toBe(
            "/api/cache/%40scope%2Fpkg"
        );
    });

    it("throws on missing param", () => {
        expect(() => interpolatePath("/api/projects/:id", {})).toThrow(
            'missing value for param "id"'
        );
    });
});
