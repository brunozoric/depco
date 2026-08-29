import { describe, it, expect, beforeEach, vi } from "vitest";
import { createContainer, registerFeatures } from "#shared/index.js";
import { OsvQueryService } from "../abstractions/OsvQueryService.js";
import { mapCvssScoreToSeverity } from "../mapCvssScoreToSeverity.js";
import { SharedVulnerabilityFeature } from "../feature.js";

describe("OsvQueryService", () => {
    let service: OsvQueryService.Interface;

    beforeEach(() => {
        const container = createContainer();
        registerFeatures(container, [SharedVulnerabilityFeature]);
        service = container.resolve(OsvQueryService);
    });

    describe("queryBatch", () => {
        it("returns advisories grouped by cache key", async () => {
            const mockResponse = {
                results: [
                    {
                        vulns: [
                            {
                                id: "GHSA-1234",
                                summary: "XSS in foo",
                                aliases: ["CVE-2024-1234"],
                                severity: [
                                    {
                                        type: "CVSS_V3",
                                        score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N"
                                    }
                                ],
                                affected: [
                                    {
                                        ranges: [
                                            {
                                                type: "ECOSYSTEM",
                                                events: [{ introduced: "0" }, { fixed: "2.0.0" }]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    },
                    { vulns: [] }
                ]
            };

            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response(JSON.stringify(mockResponse), { status: 200 })
            );

            const result = await service.queryBatch({
                packages: [
                    { name: "foo", version: "1.0.0" },
                    { name: "bar", version: "2.0.0" }
                ]
            });

            expect(result.get("foo@1.0.0")).toHaveLength(1);
            expect(result.get("foo@1.0.0")![0]!.id).toBe("GHSA-1234");
            expect(result.get("foo@1.0.0")![0]!.severity).toBe("moderate");
            expect(result.get("bar@2.0.0") ?? []).toEqual([]);
        });

        it("propagates network errors instead of swallowing them", async () => {
            // A thin, transparent API client must not swallow failures: the
            // server-side OsvCacheService caches whatever this returns for
            // up to 24h, so an empty map here would read as a false "no
            // vulnerabilities" during a transient OSV outage. Callers (the
            // CLI's scan step, OsvCacheService) own the decision on how to
            // degrade gracefully.
            vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

            await expect(
                service.queryBatch({
                    packages: [{ name: "foo", version: "1.0.0" }]
                })
            ).rejects.toThrow("Network error");
        });

        it("propagates errors from a non-OK batch response", async () => {
            vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
                new Response("", { status: 500, statusText: "Internal Server Error" })
            );

            await expect(
                service.queryBatch({
                    packages: [{ name: "foo", version: "1.0.0" }]
                })
            ).rejects.toThrow(/OSV batch query failed/);
        });

        it("handles empty package list", async () => {
            const result = await service.queryBatch({ packages: [] });
            expect(result.size).toBe(0);
        });
    });

    describe("mapCvssScoreToSeverity", () => {
        it("maps scores to correct severity", () => {
            expect(mapCvssScoreToSeverity(9.5)).toBe("critical");
            expect(mapCvssScoreToSeverity(9.0)).toBe("critical");
            expect(mapCvssScoreToSeverity(7.5)).toBe("high");
            expect(mapCvssScoreToSeverity(7.0)).toBe("high");
            expect(mapCvssScoreToSeverity(5.0)).toBe("moderate");
            expect(mapCvssScoreToSeverity(4.0)).toBe("moderate");
            expect(mapCvssScoreToSeverity(2.0)).toBe("low");
            expect(mapCvssScoreToSeverity(0.1)).toBe("low");
            expect(mapCvssScoreToSeverity(0.0)).toBe("info");
        });
    });
});
