import { describe, it, expect } from "vitest";
import { z } from "zod";

const NODE_RELEASES_API_URL = "https://endoflife.date/api/nodejs.json";

const nodeReleaseApiEntrySchema = z.object({
    cycle: z.string(),
    releaseDate: z.string(),
    lts: z.union([z.literal(false), z.literal(true), z.string()]),
    maintenance: z.string().optional(),
    eol: z.union([z.literal(false), z.literal(true), z.string()]),
    codename: z.string().optional()
});

const nodeReleaseApiResponseSchema = z.array(nodeReleaseApiEntrySchema);

describe("NodeReleaseDataService — external API contract", () => {
    it("endoflife.date /api/nodejs.json matches our Zod schema", async () => {
        const response = await fetch(NODE_RELEASES_API_URL);
        expect(response.ok).toBe(true);

        const json: unknown = await response.json();
        const result = nodeReleaseApiResponseSchema.safeParse(json);

        if (!result.success) {
            const paths = result.error.issues.map(
                issue => `[${issue.path.join(".")}]: ${issue.message}`
            );
            expect.fail(`Schema mismatch — endoflife.date API shape changed.\n${paths.join("\n")}`);
        }

        expect(result.data.length).toBeGreaterThan(0);
    });

    it("every major-version entry with a string eol produces a valid Date", async () => {
        const response = await fetch(NODE_RELEASES_API_URL);
        const json: unknown = await response.json();
        const result = nodeReleaseApiResponseSchema.safeParse(json);
        expect(result.success).toBe(true);
        if (!result.success) {
            return;
        }

        for (const entry of result.data) {
            if (!/^\d+$/.test(entry.cycle)) {
                continue;
            }
            if (typeof entry.eol === "string") {
                expect(Number.isNaN(Date.parse(entry.eol))).toBe(false);
            }
            if (typeof entry.lts === "string") {
                expect(Number.isNaN(Date.parse(entry.lts))).toBe(false);
            }
            if (entry.maintenance) {
                expect(Number.isNaN(Date.parse(entry.maintenance))).toBe(false);
            }
        }
    });
});
