import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubHttpFileResolver } from "../resolvers/GitHubHttpFileResolver.js";
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

const CHANGELOG_CONTENT = [
    "# Changelog",
    "",
    "## 3.0.0",
    "",
    "- Breaking change",
    "",
    "## 2.0.0",
    "",
    "- New feature"
].join("\n");

function toBase64(content: string): string {
    return Buffer.from(content, "utf-8").toString("base64");
}

describe("GitHubHttpFileResolver", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("has the name 'github-http-file'", () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);
        expect(resolver.name).toBe("github-http-file");
    });

    it("returns empty map when repoUrl is null", async () => {
        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);
        const result = await resolver.resolve("pkg", null, ["3.0.0"]);
        expect(result.size).toBe(0);
    });

    it("fetches and decodes base64 CHANGELOG.md content", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: toBase64(CHANGELOG_CONTENT),
                encoding: "base64"
            })
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);

        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["3.0.0"]);

        expect(result.size).toBe(1);
        expect(result.get("3.0.0")).toContain("Breaking change");
    });

    it("tries repoDirectory path first", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: toBase64(CHANGELOG_CONTENT),
                encoding: "base64"
            })
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);

        await resolver.resolve("pkg", "https://github.com/owner/repo", ["3.0.0"], "packages/core");

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining("contents/packages/core/CHANGELOG.md"),
            expect.anything()
        );
    });

    it("falls through on 404 to next path", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                content: toBase64(CHANGELOG_CONTENT),
                encoding: "base64"
            })
        });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);

        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["3.0.0"]);

        expect(result.size).toBe(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("sends Authorization header when token is configured", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

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
        deps.encryptionService.decrypt = async () => "ghp_token123";

        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);
        await resolver.resolve("pkg", "https://github.com/owner/repo", ["1.0.0"]);

        expect(fetchMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer ghp_token123"
                })
            })
        );
    });

    it("returns empty map when all paths return 404", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404 });

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);
        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["3.0.0"]);

        expect(result.size).toBe(0);
    });

    it("returns empty map on fetch error", async () => {
        fetchMock.mockRejectedValue(new Error("network error"));

        const deps = createMockDeps();
        const resolver = new GitHubHttpFileResolver(deps.databaseClient, deps.encryptionService);
        const result = await resolver.resolve("pkg", "https://github.com/owner/repo", ["3.0.0"]);

        expect(result.size).toBe(0);
    });
});
