import { realpath } from "fs/promises";
import { resolve } from "path";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { ScanFilesystemUseCase as Abstraction } from "./abstractions/ScanFilesystemUseCase.js";
import {
    readWorkspaces,
    resolveWorkspacePatterns,
    scanRecursive
} from "./filesystemScanHelpers.js";

class ScanFilesystemUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const depth = Math.min(params.depth, 5);

        let resolvedPath: string;
        try {
            resolvedPath = await realpath(resolve(params.path));
        } catch {
            return Result.fail({
                statusCode: 400,
                message: `Path does not exist: ${params.path}`
            });
        }

        try {
            const rows = await this.databaseClient.db
                .select({ path: projects.path })
                .from(projects)
                .all();
            const existingPaths = new Set(rows.map(row => row.path));

            const workspaces = await readWorkspaces(resolvedPath);
            if (workspaces.found) {
                const workspaceItems = await resolveWorkspacePatterns(
                    resolvedPath,
                    workspaces.patterns
                );

                if (workspaceItems.length > 0) {
                    const filtered = workspaceItems
                        .filter(item => !existingPaths.has(item.path))
                        .sort((a, b) => a.name.localeCompare(b.name));

                    return Result.ok({
                        items: filtered,
                        total: filtered.length,
                        scannedPath: resolvedPath,
                        scannedCount: workspaceItems.length,
                        filteredCount: filtered.length,
                        mode: "workspaces"
                    });
                }
                // Workspaces declared but resolved to nothing — fall through to depth scan.
            }

            const scanResult = await scanRecursive(resolvedPath, depth);

            const filtered = scanResult.items
                .filter(item => !existingPaths.has(item.path))
                .sort((a, b) => a.name.localeCompare(b.name));

            return Result.ok({
                items: filtered,
                total: filtered.length,
                scannedPath: resolvedPath,
                scannedCount: scanResult.scannedCount,
                filteredCount: filtered.length,
                mode: "depth"
            });
        } catch (error) {
            return Result.fail({ statusCode: 500, message: (error as Error).message });
        }
    }
}

export const ScanFilesystemUseCase = Abstraction.createImplementation({
    implementation: ScanFilesystemUseCaseImpl,
    dependencies: [DatabaseClient]
});
