import { join } from "path";
import { eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Container } from "@webiny/di";
import { registerRoute, sendOne, sendList, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    exportProjectsRoute,
    importProjectsRoute,
    cloneProjectRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { SecurityService } from "../../services/Security/index.js";
import { PackageManagerService } from "../../services/PackageManager/index.js";
import { JobWorker } from "../../services/JobExecution/index.js";
import { registerProject as registerProjectHelper } from "../../utils/registerProject.js";
import { projects } from "#api/db/schema.js";
import { access } from "fs/promises";

function extractRepoName(url: string): string | null {
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) {
        return match[1]!;
    }
    const sshMatch = url.match(/:([^/]+?)(?:\.git)?$/);
    return sshMatch?.[1] ?? null;
}

export function registerProjectBulkRoutes(app: FastifyInstance, container: Container): void {
    const databaseClient = container.resolve(DatabaseClient);
    const securityService = container.resolve(SecurityService);
    const packageManagerService = container.resolve(PackageManagerService);
    const jobWorker = container.resolve(JobWorker);
    const { db } = databaseClient;

    registerRoute(app, exportProjectsRoute, {}, async (_request, reply) => {
        const allProjects = await db.select().from(projects).all();
        sendList({
            reply,
            items: allProjects.map(project => ({ path: project.path })),
            total: allProjects.length
        });
    });

    registerRoute(
        app,
        importProjectsRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const results: {
                path: string;
                status: "added" | "skipped" | "failed";
                error?: string;
            }[] = [];

            const requestedPaths = request.body.items.map(item => item.path);
            const existingRows = await db
                .select({ path: projects.path })
                .from(projects)
                .where(inArray(projects.path, requestedPaths))
                .all();
            const existingPaths = new Set(existingRows.map(r => r.path));

            for (const { path: projectPath } of request.body.items) {
                if (existingPaths.has(projectPath)) {
                    results.push({ path: projectPath, status: "skipped" });
                    continue;
                }

                try {
                    const registered = await registerProjectHelper({
                        projectPath,
                        databaseClient,
                        packageManagerService
                    });

                    void securityService.check(registered.id, projectPath);
                    void jobWorker.enqueue({
                        referenceId: registered.id,
                        referenceType: "project",
                        type: "scan"
                    });

                    results.push({ path: projectPath, status: "added" });
                } catch (error) {
                    results.push({
                        path: projectPath,
                        status: "failed",
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }

            sendList({ reply, items: results, total: results.length });
        }
    );

    registerRoute(
        app,
        cloneProjectRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { url, destination, folderName } = request.body;

            if (!url.startsWith("https://") && !url.startsWith("git@")) {
                sendError({
                    reply,
                    statusCode: 400,
                    message: "Only https:// and git@ URLs are supported"
                });
                return;
            }

            const repoName = extractRepoName(url);
            if (!repoName) {
                sendError({
                    reply,
                    statusCode: 400,
                    message: "Could not extract repository name from URL"
                });
                return;
            }

            const finalFolderName = folderName || repoName;
            if (
                finalFolderName.includes("/") ||
                finalFolderName.includes("\\") ||
                finalFolderName.includes("..")
            ) {
                sendError({
                    reply,
                    statusCode: 400,
                    message: "Folder name must not contain path separators or '..'"
                });
                return;
            }

            try {
                await access(destination);
            } catch {
                sendError({
                    reply,
                    statusCode: 400,
                    message: `Destination directory does not exist: ${destination}`
                });
                return;
            }

            const finalPath = join(destination, finalFolderName);
            const existing = await db
                .select()
                .from(projects)
                .where(eq(projects.path, finalPath))
                .get();

            if (existing) {
                sendError({
                    reply,
                    statusCode: 409,
                    message: `A project is already registered at ${finalPath}`
                });
                return;
            }

            const jobId = await jobWorker.enqueue({
                referenceId: finalPath,
                referenceType: "project",
                type: "clone",
                packages: JSON.stringify({ url, destination: finalPath })
            });

            sendOne({ reply, data: { jobId } });
        }
    );
}
