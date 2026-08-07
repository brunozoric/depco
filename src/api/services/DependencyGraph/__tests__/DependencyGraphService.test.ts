import { describe, it, expect, beforeEach } from "vitest";
import { generateId } from "@webiny/stdlib";
import { dependencyEdges, projects } from "#api/db/schema.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { LockfileParserService } from "#api/services/DependencyGraph/index.js";
import { createTestDatabaseClient } from "#testing/helpers/createTestDb.js";

interface ISeedEdgeInput {
    projectId: string;
    parentPackage: string | null;
    parentVersion: string | null;
    childPackage: string;
    childVersion: string;
    dependencyType?: string;
    depth: number;
}

async function createService(
    databaseClient: DatabaseClient.Interface,
    lockfileParserService: LockfileParserService.Interface
) {
    const { DependencyGraphServiceImpl } = await import("#api/services/DependencyGraphService.js");
    return new DependencyGraphServiceImpl(databaseClient, lockfileParserService);
}

function createStubLockfileParserService(
    edges: LockfileParserService.DependencyEdge[]
): LockfileParserService.Interface {
    return {
        parse: async () => edges
    };
}

async function seedEdge(
    databaseClient: DatabaseClient.Interface,
    input: ISeedEdgeInput
): Promise<void> {
    await databaseClient.db
        .insert(dependencyEdges)
        .values({
            id: generateId(),
            projectId: input.projectId,
            parentPackage: input.parentPackage,
            parentVersion: input.parentVersion,
            childPackage: input.childPackage,
            childVersion: input.childVersion,
            dependencyType: input.dependencyType ?? "dependency",
            depth: input.depth,
            scannedAt: Date.now()
        })
        .run();
}

describe("DependencyGraphService", () => {
    let databaseClient: DatabaseClient.Interface;
    const projectId = "project-1";

    beforeEach(async () => {
        databaseClient = await createTestDatabaseClient();
        await databaseClient.db
            .insert(projects)
            .values({
                id: projectId,
                name: "Test Project",
                path: "/test",
                addedAt: Date.now()
            })
            .run();
    });

    describe("getGraph", () => {
        it("should return all edges with computed rootPackages, totalPackages, maxDepth, edgeCount", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash",
                childVersion: "4.17.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "react",
                parentVersion: "18.0.0",
                childPackage: "loose-envify",
                childVersion: "1.4.0",
                depth: 1
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "loose-envify",
                parentVersion: "1.4.0",
                childPackage: "js-tokens",
                childVersion: "4.0.0",
                depth: 2
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const graph = await service.getGraph(projectId);

            expect(graph.edgeCount).toBe(4);
            expect(graph.edges).toHaveLength(4);
            expect(graph.totalPackages).toBe(4);
            expect(graph.maxDepth).toBe(2);
            expect(graph.rootPackages.sort()).toEqual(["lodash", "react"]);
        });

        it("should return an empty graph when no edges exist", async () => {
            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const graph = await service.getGraph(projectId);

            expect(graph.edges).toEqual([]);
            expect(graph.rootPackages).toEqual([]);
            expect(graph.totalPackages).toBe(0);
            expect(graph.maxDepth).toBe(0);
            expect(graph.edgeCount).toBe(0);
        });
    });

    describe("findPaths", () => {
        it("should find a single path from root to target", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "react",
                parentVersion: "18.0.0",
                childPackage: "loose-envify",
                childVersion: "1.4.0",
                depth: 1
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "loose-envify",
                parentVersion: "1.4.0",
                childPackage: "js-tokens",
                childVersion: "4.0.0",
                depth: 2
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const paths = await service.findPaths({ projectId, packageName: "js-tokens" });

            expect(paths).toHaveLength(1);
            expect(paths[0]!.target).toBe("js-tokens");
            expect(paths[0]!.chain).toEqual([
                { packageName: "react", version: "18.0.0" },
                { packageName: "loose-envify", version: "1.4.0" },
                { packageName: "js-tokens", version: "4.0.0" }
            ]);
        });

        it("should find multiple distinct paths when the same package is reached via different parents", async () => {
            // root-a -> shared, root-b -> shared
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "root-a",
                childVersion: "1.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "root-b",
                childVersion: "1.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "root-a",
                parentVersion: "1.0.0",
                childPackage: "shared",
                childVersion: "2.0.0",
                depth: 1
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "root-b",
                parentVersion: "1.0.0",
                childPackage: "shared",
                childVersion: "2.0.0",
                depth: 1
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const paths = await service.findPaths({ projectId, packageName: "shared" });

            expect(paths).toHaveLength(2);
            const parentNames = paths.map(path => path.chain[0]!.packageName).sort();
            expect(parentNames).toEqual(["root-a", "root-b"]);
        });

        it("should return an empty array when the package is not found", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const paths = await service.findPaths({ projectId, packageName: "does-not-exist" });

            expect(paths).toEqual([]);
        });

        it("should terminate and not loop forever when edges form a cycle", async () => {
            // root -> a -> b -> a (cycle back to a)
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "a",
                childVersion: "1.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "a",
                parentVersion: "1.0.0",
                childPackage: "b",
                childVersion: "1.0.0",
                depth: 1
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: "b",
                parentVersion: "1.0.0",
                childPackage: "a",
                childVersion: "1.0.0",
                depth: 2
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const paths = await service.findPaths({ projectId, packageName: "b" });

            expect(paths).toHaveLength(1);
            expect(paths[0]!.chain).toEqual([
                { packageName: "a", version: "1.0.0" },
                { packageName: "b", version: "1.0.0" }
            ]);
        });
    });

    describe("searchPackages", () => {
        it("should return matching package names", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash",
                childVersion: "4.17.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "lodash.get",
                childVersion: "4.4.2",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "express",
                childVersion: "4.18.0",
                depth: 0
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const results = await service.searchPackages({ projectId, query: "lodash" });

            expect(results.sort()).toEqual(["lodash", "lodash.get"]);
        });

        it("should respect the limit parameter", async () => {
            for (let i = 0; i < 25; i++) {
                await seedEdge(databaseClient, {
                    projectId,
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: `matching-package-${String(i).padStart(2, "0")}`,
                    childVersion: "1.0.0",
                    depth: 0
                });
            }

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const results = await service.searchPackages({
                projectId,
                query: "matching-package",
                limit: 5
            });

            expect(results).toHaveLength(5);
        });

        it("should return an empty array when there are no matches", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const results = await service.searchPackages({ projectId, query: "does-not-exist" });

            expect(results).toEqual([]);
        });

        it("should escape LIKE wildcard characters in the query", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "foo%bar",
                childVersion: "1.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "fooXbar",
                childVersion: "1.0.0",
                depth: 0
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const results = await service.searchPackages({ projectId, query: "foo%bar" });

            expect(results).toEqual(["foo%bar"]);
        });

        it("should escape underscore wildcard characters in the query", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "foo_bar",
                childVersion: "1.0.0",
                depth: 0
            });
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "fooXbar",
                childVersion: "1.0.0",
                depth: 0
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const results = await service.searchPackages({ projectId, query: "foo_bar" });

            expect(results).toEqual(["foo_bar"]);
        });

        it("should return an empty array for a blank query", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "react",
                childVersion: "18.0.0",
                depth: 0
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const results = await service.searchPackages({ projectId, query: "   " });

            expect(results).toEqual([]);
        });
    });

    describe("refreshGraph", () => {
        it("should delete old edges and insert new ones from the parser, returning the count", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "old-package",
                childVersion: "1.0.0",
                depth: 0
            });

            const newEdges: LockfileParserService.DependencyEdge[] = [
                {
                    parentPackage: null,
                    parentVersion: null,
                    childPackage: "react",
                    childVersion: "18.0.0",
                    dependencyType: "dependency",
                    depth: 0
                },
                {
                    parentPackage: "react",
                    parentVersion: "18.0.0",
                    childPackage: "loose-envify",
                    childVersion: "1.4.0",
                    dependencyType: "dependency",
                    depth: 1
                }
            ];

            const service = await createService(
                databaseClient,
                createStubLockfileParserService(newEdges)
            );
            const count = await service.refreshGraph(projectId, "/test", "npm");

            expect(count).toBe(2);

            const graph = await service.getGraph(projectId);
            expect(graph.edgeCount).toBe(2);
            expect(graph.edges.some(edge => edge.childPackage === "old-package")).toBe(false);
            expect(graph.rootPackages).toEqual(["react"]);
        });

        it("should return 0 and clear existing edges when the parser returns none", async () => {
            await seedEdge(databaseClient, {
                projectId,
                parentPackage: null,
                parentVersion: null,
                childPackage: "old-package",
                childVersion: "1.0.0",
                depth: 0
            });

            const service = await createService(
                databaseClient,
                createStubLockfileParserService([])
            );
            const count = await service.refreshGraph(projectId, "/test", "npm");

            expect(count).toBe(0);

            const graph = await service.getGraph(projectId);
            expect(graph.edgeCount).toBe(0);
        });
    });
});
