import { and, eq, sql } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { DependencyGraphService as Abstraction } from "./abstractions/DependencyGraphService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { LockfileParserService } from "./abstractions/LockfileParserService.js";
import { dependencyEdges } from "#api/db/schema.js";

type DependencyEdgeRow = typeof dependencyEdges.$inferSelect;

interface IPathQueueEntry {
    chain: Abstraction.PathNode[];
    visitedPackageNames: Set<string>;
}

function rowToEdge(row: DependencyEdgeRow): Abstraction.Edge {
    return {
        parentPackage: row.parentPackage,
        parentVersion: row.parentVersion,
        childPackage: row.childPackage,
        childVersion: row.childVersion,
        dependencyType: row.dependencyType,
        depth: row.depth
    };
}

function buildAdjacencyMap(edges: Abstraction.Edge[]): Map<string, Abstraction.Edge[]> {
    const adjacencyMap = new Map<string, Abstraction.Edge[]>();

    for (const edge of edges) {
        if (edge.parentPackage === null) {
            continue;
        }
        const key = `${edge.parentPackage}@${edge.parentVersion}`;
        const children = adjacencyMap.get(key) ?? [];
        children.push(edge);
        adjacencyMap.set(key, children);
    }

    return adjacencyMap;
}

class DependencyGraphServiceImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly lockfileParserService: LockfileParserService.Interface
    ) {}

    public async getGraph(projectId: string): Promise<Abstraction.Graph> {
        const rows = await this.databaseClient.db
            .select()
            .from(dependencyEdges)
            .where(eq(dependencyEdges.projectId, projectId))
            .all();

        const edges = rows.map(rowToEdge);

        const rootPackageNames = new Set<string>();
        const allPackageNames = new Set<string>();
        let maxDepth = 0;

        for (const edge of edges) {
            allPackageNames.add(edge.childPackage);
            if (edge.depth === 0) {
                rootPackageNames.add(edge.childPackage);
            }
            if (edge.depth > maxDepth) {
                maxDepth = edge.depth;
            }
        }

        return {
            edges,
            rootPackages: [...rootPackageNames],
            totalPackages: allPackageNames.size,
            maxDepth,
            edgeCount: edges.length
        };
    }

    public async searchPackages(params: Abstraction.SearchPackagesParams): Promise<string[]> {
        const { projectId, query, limit = 20 } = params;

        if (!query.trim()) {
            return [];
        }

        const rows = await this.databaseClient.db
            .selectDistinct({ name: dependencyEdges.childPackage })
            .from(dependencyEdges)
            .where(
                and(
                    eq(dependencyEdges.projectId, projectId),
                    sql`${dependencyEdges.childPackage} LIKE ${"%" + query.replace(/[%_\\]/g, "\\$&") + "%"} ESCAPE '\\'`
                )
            )
            .orderBy(dependencyEdges.childPackage)
            .limit(limit)
            .all();

        return rows.map(row => row.name);
    }

    public async findPaths(params: Abstraction.FindPathsParams): Promise<Abstraction.Path[]> {
        const { projectId, packageName } = params;
        const graph = await this.getGraph(projectId);
        const adjacencyMap = buildAdjacencyMap(graph.edges);

        const paths: Abstraction.Path[] = [];
        const queue: IPathQueueEntry[] = [];

        for (const rootEdge of graph.edges) {
            if (rootEdge.parentPackage !== null) {
                continue;
            }

            const chain: Abstraction.PathNode[] = [
                { packageName: rootEdge.childPackage, version: rootEdge.childVersion }
            ];
            const visitedPackageNames = new Set<string>([rootEdge.childPackage]);

            if (rootEdge.childPackage === packageName) {
                paths.push({ target: packageName, chain });
                continue;
            }

            queue.push({ chain, visitedPackageNames });
        }

        while (queue.length > 0) {
            const { chain, visitedPackageNames } = queue.shift()!;
            const current = chain[chain.length - 1]!;
            const children = adjacencyMap.get(`${current.packageName}@${current.version}`) ?? [];

            for (const childEdge of children) {
                if (visitedPackageNames.has(childEdge.childPackage)) {
                    continue;
                }

                const childChain: Abstraction.PathNode[] = [
                    ...chain,
                    { packageName: childEdge.childPackage, version: childEdge.childVersion }
                ];
                const childVisitedPackageNames = new Set(visitedPackageNames);
                childVisitedPackageNames.add(childEdge.childPackage);

                if (childEdge.childPackage === packageName) {
                    paths.push({ target: packageName, chain: childChain });
                    continue;
                }

                queue.push({ chain: childChain, visitedPackageNames: childVisitedPackageNames });
            }
        }

        return paths;
    }

    public async refreshGraph(
        projectId: string,
        projectPath: string,
        packageManager: string
    ): Promise<number> {
        const parsedEdges = await this.lockfileParserService.parse(projectPath, packageManager);
        const now = Date.now();

        this.databaseClient.db.transaction(tx => {
            tx.delete(dependencyEdges).where(eq(dependencyEdges.projectId, projectId)).run();

            if (parsedEdges.length === 0) {
                return;
            }

            const rows = parsedEdges.map(edge => ({
                id: generateId(),
                projectId,
                parentPackage: edge.parentPackage,
                parentVersion: edge.parentVersion,
                childPackage: edge.childPackage,
                childVersion: edge.childVersion,
                dependencyType: edge.dependencyType,
                depth: edge.depth,
                scannedAt: now
            }));

            const BATCH_SIZE = 100;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                tx.insert(dependencyEdges)
                    .values(rows.slice(i, i + BATCH_SIZE))
                    .run();
            }
        });

        return parsedEdges.length;
    }
}

export { DependencyGraphServiceImpl };

export const DependencyGraphService = Abstraction.createImplementation({
    implementation: DependencyGraphServiceImpl,
    dependencies: [DatabaseClient, LockfileParserService]
});
