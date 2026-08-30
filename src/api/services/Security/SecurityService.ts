import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { parse as parseToml } from "smol-toml";
import { desc, eq, inArray } from "drizzle-orm";
import { generateId } from "@webiny/stdlib";
import { SecurityService as Abstraction } from "./abstractions/SecurityService.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects, securityChecks, pmSecuritySettings } from "#api/db/schema.js";
import { SECURITY_FIELD_REGISTRY, type PackageManagerId } from "#shared/security/index.js";

type ConfigValues = Record<string, unknown>;

function flattenObject(source: Record<string, unknown>, prefix = ""): ConfigValues {
    const result: ConfigValues = {};
    for (const [key, value] of Object.entries(source)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (value != null && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value as Record<string, unknown>, path));
        } else {
            result[path] = value;
        }
    }
    return result;
}

function parseConfigFile(fileName: string, content: string): ConfigValues {
    if (fileName.endsWith(".yml") || fileName.endsWith(".yaml")) {
        return (parseYaml(content) as ConfigValues) ?? {};
    }

    if (fileName.endsWith(".json")) {
        return (JSON.parse(content) as ConfigValues) ?? {};
    }

    if (fileName.endsWith(".toml")) {
        return flattenObject(parseToml(content) as Record<string, unknown>);
    }

    // Fallback for flat key=value config files (e.g. .npmrc).
    const config: ConfigValues = {};
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
            continue;
        }
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }
        config[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
    }
    return config;
}

class SecurityServiceImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async check(projectId: string, projectPath: string): Promise<Abstraction.CheckResult> {
        const project = await this.databaseClient.db
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .get();

        const settings = project?.packageManager
            ? (
                  await this.databaseClient.db
                      .select()
                      .from(pmSecuritySettings)
                      .where(eq(pmSecuritySettings.packageManager, project.packageManager))
                      .all()
              ).filter(s => s.enabled === 1)
            : [];

        if (settings.length === 0) {
            const result: Abstraction.CheckResult = { passes: true, checks: {} };
            await this.persistResult(projectId, result);
            return result;
        }

        const configFiles = new Set(settings.map(setting => setting.configFile));
        const configs = new Map<string, ConfigValues>();
        for (const configFile of configFiles) {
            try {
                const content = await readFile(join(projectPath, configFile), "utf-8");
                configs.set(configFile, parseConfigFile(configFile, content));
            } catch {
                configs.set(configFile, {});
            }
        }

        const registry = SECURITY_FIELD_REGISTRY[project!.packageManager as PackageManagerId] ?? [];
        const checks: Record<string, boolean> = {};
        for (const setting of settings) {
            const config = configs.get(setting.configFile) ?? {};
            const fieldDef = registry.find(field => field.fieldName === setting.fieldName);

            if (fieldDef) {
                checks[setting.fieldName] = fieldDef.compare(
                    config[setting.fieldName],
                    setting.expectedValue
                );
            } else {
                const fieldPresent = setting.fieldName in config;
                checks[setting.fieldName] =
                    setting.expectedValue === "exists"
                        ? fieldPresent
                        : fieldPresent &&
                          String(config[setting.fieldName]) === setting.expectedValue;
            }
        }

        const result: Abstraction.CheckResult = {
            passes: Object.values(checks).every(Boolean),
            checks
        };

        await this.persistResult(projectId, result);
        return result;
    }

    public async getLatest(projectId: string): Promise<Abstraction.CheckResult | null> {
        const row = await this.databaseClient.db
            .select()
            .from(securityChecks)
            .where(eq(securityChecks.projectId, projectId))
            .orderBy(desc(securityChecks.checkedAt))
            .get();

        if (!row) {
            return null;
        }

        let checks: Record<string, boolean>;
        try {
            checks = JSON.parse(row.results) as Record<string, boolean>;
        } catch {
            checks = {};
        }

        return {
            passes: row.passes === 1,
            checks
        };
    }

    public async getLatestForProjects(
        projectIds: string[]
    ): Promise<Map<string, Abstraction.CheckResult>> {
        const resultMap = new Map<string, Abstraction.CheckResult>();
        if (projectIds.length === 0) {
            return resultMap;
        }

        const rows = await this.databaseClient.db
            .select()
            .from(securityChecks)
            .where(inArray(securityChecks.projectId, projectIds))
            .orderBy(desc(securityChecks.checkedAt))
            .all();

        for (const row of rows) {
            if (resultMap.has(row.projectId)) {
                continue;
            }
            let checks: Record<string, boolean>;
            try {
                checks = JSON.parse(row.results) as Record<string, boolean>;
            } catch {
                checks = {};
            }
            resultMap.set(row.projectId, {
                passes: row.passes === 1,
                checks
            });
        }

        return resultMap;
    }

    private async persistResult(projectId: string, result: Abstraction.CheckResult): Promise<void> {
        await this.databaseClient.db
            .insert(securityChecks)
            .values({
                id: generateId(),
                projectId,
                checkedAt: Date.now(),
                results: JSON.stringify(result.checks),
                passes: result.passes ? 1 : 0
            })
            .run();
    }
}

export const SecurityService = Abstraction.createImplementation({
    implementation: SecurityServiceImpl,
    dependencies: [DatabaseClient]
});
