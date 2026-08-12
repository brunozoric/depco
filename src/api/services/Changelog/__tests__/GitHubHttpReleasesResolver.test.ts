import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubHttpReleasesResolver } from "../resolvers/GitHubHttpReleasesResolver.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { EncryptionService } from "#api/services/Encryption/abstractions/EncryptionService.js";

interface IMockDeps {
    databaseClient: DatabaseClient.Interface;
    encryptionService: EncryptionService.Interface;
}

function createMockDeps(): IMockDeps {
    return {
        databaseClient: {
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            get: async () => null
                        })
                    })
                })
            }
        } as unknown as DatabaseClient.Interface,
        encryptionService: {
            encrypt: async (value: string) => value,
            decrypt: async (value: string) => value,
            isAvailable: () => true
        }
    };
}

const RELEASES_JSON = JSON.stringify([
    { tag_name: "v3.0.0", body: "## Breaking changes\n\nDropped Node 14" },
    { tag_name: "v2.0.0", body: "## New features\n\nAdded widgets" },
    { tag_name: "v1.0.0", body: null }
]);

describe("GitHubHttpReleasesResolver", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("has the name 'github-http-releases'", () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        expect(resolver.name).toBe("github-http-releases");
    });

    it("returns empty map when repoUrl is null", async () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve("pkg", null, ["3.0.0"]);
        expect(result.size).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("fetches releases and matches versions by stripping v prefix", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => JSON.parse(RELEASES_JSON)
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );

        const result = await resolver.resolve("some-pkg", "https://github.com/owner/repo", [
            "3.0.0",
            "2.0.0"
        ]);

        expect(result.size).toBe(2);
        expect(result.get("3.0.0")).toContain("Dropped Node 14");
        expect(result.get("2.0.0")).toContain("Added widgets");
    });

    it("handles monorepo tags with packageName@version format", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => [
                { tag_name: "@scope/pkg@4.0.0", body: "Release 4.0" },
                { tag_name: "other-pkg@4.0.0", body: "Wrong package" }
            ]
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );

        const result = await resolver.resolve("@scope/pkg", "https://github.com/owner/repo", [
            "4.0.0"
        ]);

        expect(result.size).toBe(1);
        expect(result.get("4.0.0")).toBe("Release 4.0");
    });

    it("sends Authorization header when github_token is configured", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        const deps = createMockDeps();
        deps.databaseClient = {
            db: {
                select: () => ({
                    from: () => ({
                        where: () => ({
                            get: async () => ({ key: "github_token", value: "encrypted" })
                        })
                    })
                })
            }
        } as unknown as DatabaseClient.Interface;
        deps.encryptionService.decrypt = async () => "ghp_realtoken";

        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("api.github.com"),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer ghp_realtoken"
                })
            })
        );
    });

    it("works without auth header when no token configured", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        const callArgs = fetchMock.mock.calls[0];
        const headers =
            (callArgs?.[1] as { headers?: Record<string, string> } | undefined)?.headers ?? {};
        expect(headers).not.toHaveProperty("Authorization");
    });

    it("returns empty map on HTTP error", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 403 });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(result.size).toBe(0);
    });

    it("returns empty map on fetch error", async () => {
        fetchMock.mockRejectedValueOnce(new Error("network error"));

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(result.size).toBe(0);
    });

    it("returns empty map on invalid JSON response (Zod validation)", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ not: "an array" })
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(result.size).toBe(0);
    });

    it("skips releases with null body", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => [{ tag_name: "v1.0.0", body: null }]
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpReleasesResolver(
            deps.databaseClient,
            deps.encryptionService
        );
        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(result.size).toBe(0);
    });
});
