import { readFile } from "fs/promises";
import { join } from "path";
import { and, eq } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import type { ScanService } from "../../Scan/index.js";
import {
    pmSecuritySettings,
    dependencies,
    dependencyVersions,
    changelogs
} from "#api/db/schema.js";
import { parseDuration } from "#shared/security/index.js";

const AGE_GATE_FIELDS: Record<string, string> = {
    yarn: "npmMinimalAgeGate",
    npm: "minimal-age-gate",
    pnpm: "minimal-age-gate",
    bun: "minimal-age-gate"
};

export async function hasPackageJsonDependencies(projectPath: string): Promise<boolean> {
    try {
        const content = await readFile(join(projectPath, "package.json"), "utf-8");
        const pkg = JSON.parse(content) as Record<string, unknown>;
        const deps = Object.keys((pkg["dependencies"] as Record<string, string>) ?? {});
        const devDeps = Object.keys((pkg["devDependencies"] as Record<string, string>) ?? {});
        return deps.length + devDeps.length > 0;
    } catch {
        return false;
    }
}

export async function resolveMinimalAgeSeconds(
    db: DatabaseClient.Interface["db"],
    packageManager: string
): Promise<number | undefined> {
    const fieldName = AGE_GATE_FIELDS[packageManager];
    if (!fieldName) {
        return undefined;
    }

    const setting = await db
        .select()
        .from(pmSecuritySettings)
        .where(
            and(
                eq(pmSecuritySettings.packageManager, packageManager),
                eq(pmSecuritySettings.fieldName, fieldName)
            )
        )
        .get();

    if (!setting) {
        return undefined;
    }

    try {
        return parseDuration(setting.expectedValue);
    } catch {
        return undefined;
    }
}

interface IInsertChangelogPlaceholdersInput {
    db: DatabaseClient.Interface["db"];
    scanDependencies: ScanService.Dependency[];
    registryData: Map<string, ScanService.RegistryData>;
    minimalAgeSeconds?: number | undefined;
}

export async function insertChangelogPlaceholders(
    input: IInsertChangelogPlaceholdersInput
): Promise<void> {
    const { db, scanDependencies, registryData, minimalAgeSeconds } = input;
    const ageCutoff =
        minimalAgeSeconds !== undefined ? Date.now() - minimalAgeSeconds * 1000 : undefined;

    for (const dep of scanDependencies) {
        const data = registryData.get(dep.name);
        if (!data || dep.latestVersion === null) {
            continue;
        }

        const currentIndex = data.versions.indexOf(dep.currentVersion);
        const latestIndex = data.versions.indexOf(dep.latestVersion);
        if (latestIndex === -1) {
            continue;
        }

        const startIndex = currentIndex === -1 ? 0 : currentIndex + 1;
        let upgradeableVersions = data.versions
            .slice(startIndex, latestIndex + 1)
            .filter(version => !version.includes("-"));

        if (ageCutoff !== undefined) {
            upgradeableVersions = upgradeableVersions.filter(version => {
                const publishTime = data.time[version];
                return publishTime ? new Date(publishTime).getTime() <= ageCutoff : true;
            });
        }

        const versionsToStore =
            upgradeableVersions.length > 0 ? upgradeableVersions : [dep.currentVersion];

        await db
            .insert(dependencies)
            .values({
                id: generateId(),
                name: dep.name,
                repoUrl: data.repoUrl,
                repoDirectory: data.repoDirectory,
                createdAt: Date.now()
            })
            .onConflictDoUpdate({
                target: dependencies.name,
                set: { repoUrl: data.repoUrl, repoDirectory: data.repoDirectory }
            })
            .run();

        const depRow = await db
            .select({ id: dependencies.id })
            .from(dependencies)
            .where(eq(dependencies.name, dep.name))
            .get();

        if (!depRow) {
            continue;
        }

        const dependencyId = depRow.id;

        for (const version of versionsToStore) {
            const publishedAt = data.time[version] ? new Date(data.time[version]!).getTime() : null;

            await db
                .insert(dependencyVersions)
                .values({
                    id: generateId(),
                    dependencyId,
                    version,
                    publishedAt
                })
                .onConflictDoNothing()
                .run();

            const versionRow = await db
                .select({ id: dependencyVersions.id })
                .from(dependencyVersions)
                .where(
                    and(
                        eq(dependencyVersions.dependencyId, dependencyId),
                        eq(dependencyVersions.version, version)
                    )
                )
                .get();

            if (!versionRow) {
                continue;
            }

            const existingChangelog = await db
                .select({ id: changelogs.id })
                .from(changelogs)
                .where(eq(changelogs.dependencyVersionId, versionRow.id))
                .get();

            if (!existingChangelog) {
                await db
                    .insert(changelogs)
                    .values({
                        id: generateId(),
                        dependencyId,
                        dependencyVersionId: versionRow.id
                    })
                    .run();
            }
        }
    }
}
