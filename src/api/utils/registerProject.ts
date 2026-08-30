import { readFile } from "fs/promises";
import { join, basename } from "path";
import { z } from "zod";
import { generateId } from "@webiny/stdlib";
import type { PackageManagerService } from "../services/PackageManager/index.js";
import type { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";

const packageJsonSchema = z.object({
    name: z.string().optional()
});

export interface RegisterProjectParams {
    projectPath: string;
    databaseClient: DatabaseClient.Interface;
    packageManagerService: PackageManagerService.Interface;
}

export interface RegisteredProject {
    id: string;
    name: string;
    path: string;
    packageManager: string | null;
    pmVersion: string | null;
    addedAt: number;
}

export async function registerProject(params: RegisterProjectParams): Promise<RegisteredProject> {
    const { projectPath, databaseClient, packageManagerService } = params;

    let name: string;
    try {
        const pkgContent = await readFile(join(projectPath, "package.json"), "utf-8");
        const parseResult = packageJsonSchema.safeParse(JSON.parse(pkgContent));
        name = parseResult.success
            ? (parseResult.data.name ?? basename(projectPath))
            : basename(projectPath);
    } catch {
        name = basename(projectPath);
    }

    let packageManager: string | null;
    try {
        packageManager = await packageManagerService.detect(projectPath);
    } catch {
        packageManager = null;
    }

    let pmVersion: string | null;
    try {
        pmVersion = packageManager
            ? await packageManagerService.getVersion(projectPath, packageManager)
            : null;
    } catch {
        pmVersion = null;
    }

    const id = generateId();
    const addedAt = Date.now();
    await databaseClient.db
        .insert(projects)
        .values({ id, name, path: projectPath, packageManager, pmVersion, addedAt })
        .run();

    return { id, name, path: projectPath, packageManager, pmVersion, addedAt };
}
