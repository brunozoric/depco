import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { Container } from "@webiny/di";
import semver from "semver";
import { eq, sql } from "drizzle-orm";
import { registerRoute, sendOne, sendError } from "#shared/routing/index.js";
import { requirePermission } from "#api/middleware/requirePermission.js";
import {
    listPackagesRoute,
    rescanPackageRoute,
    getPackageDetailRoute
} from "#shared/routes/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { RegistryCacheService } from "../services/RegistryCache/index.js";
import { PackageQueryService } from "../services/Package/index.js";
import { scanResults } from "#api/db/schema.js";

interface PluginOptions extends FastifyPluginOptions {
    container: Container;
}

export async function packagesRoutes(app: FastifyInstance, options: PluginOptions): Promise<void> {
    const { container } = options;
    const databaseClient = container.resolve(DatabaseClient);
    const packageQueryService = container.resolve(PackageQueryService);
    const { db } = databaseClient;

    registerRoute(app, listPackagesRoute, {}, async (request, reply) => {
        const result = await packageQueryService.listPackages(request.query);
        reply.send(result);
    });

    registerRoute(app, getPackageDetailRoute, {}, async (request, reply) => {
        const { packageName } = request.params;

        const detail = await packageQueryService.getPackageDetail(packageName);

        if (!detail) {
            sendError({ reply, statusCode: 404, message: "Package not found" });
            return;
        }

        sendOne({ reply, data: detail });
    });

    const registryCacheService = container.resolve(RegistryCacheService);

    registerRoute(
        app,
        rescanPackageRoute,
        { preHandler: [requirePermission("full")] },
        async (request, reply) => {
            const { packageName } = request.params;

            const rows = await db
                .select()
                .from(scanResults)
                .where(eq(scanResults.name, packageName))
                .all();

            if (rows.length === 0) {
                sendOne({ reply: reply, data: { updated: 0 } });
                return;
            }

            const packageManager =
                (
                    await db.all<{ package_manager: string }>(
                        sql`SELECT p.package_manager FROM projects p
                            JOIN scan_results sr ON sr.project_id = p.id
                            WHERE sr.name = ${packageName} LIMIT 1`
                    )
                )[0]?.package_manager ?? "npm";

            const info = await registryCacheService.getPackageInfo(
                packageName,
                packageManager,
                true
            );

            let updated = 0;
            for (const row of rows) {
                const resolvedLatest =
                    semver.valid(info.latestVersion) &&
                    semver.valid(row.currentVersion) &&
                    semver.lt(info.latestVersion, row.currentVersion)
                        ? row.currentVersion
                        : info.latestVersion;

                let upgradeType: string = "none";
                if (row.currentVersion !== resolvedLatest) {
                    const diff = semver.diff(row.currentVersion, resolvedLatest);
                    if (diff && semver.gt(resolvedLatest, row.currentVersion)) {
                        if (diff === "major" || diff === "premajor") {
                            upgradeType = "major";
                        } else if (diff === "minor" || diff === "preminor") {
                            upgradeType = "minor";
                        } else {
                            upgradeType = "patch";
                        }
                    }
                }

                await db
                    .update(scanResults)
                    .set({
                        latestVersion: resolvedLatest,
                        upgradeType,
                        scannedAt: Date.now()
                    })
                    .where(eq(scanResults.id, row.id))
                    .run();
                updated++;
            }

            sendOne({ reply: reply, data: { updated } });
        }
    );
}
