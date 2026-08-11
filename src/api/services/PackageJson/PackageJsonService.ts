import { readFile } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { PackageJsonService as Abstraction } from "./abstractions/PackageJsonService.js";
import type { IDiscoveredScript } from "./abstractions/PackageJsonService.js";

interface IPackageJsonScripts {
    scripts?: Record<string, string>;
}

const packageJsonScriptsSchema = z.object({
    scripts: z.record(z.string(), z.string()).optional()
});

class PackageJsonServiceImpl implements Abstraction.Interface {
    public async getScripts(projectPath: string): Promise<IDiscoveredScript[]> {
        let raw: string;
        try {
            raw = await readFile(join(projectPath, "package.json"), "utf-8");
        } catch {
            return [];
        }

        let parsed: IPackageJsonScripts;
        try {
            parsed = packageJsonScriptsSchema.parse(JSON.parse(raw)) as IPackageJsonScripts;
        } catch {
            return [];
        }

        if (!parsed.scripts || typeof parsed.scripts !== "object") {
            return [];
        }

        return Object.entries(parsed.scripts)
            .map(([name, command]) => ({ name, command }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}

export const PackageJsonService = Abstraction.createImplementation({
    implementation: PackageJsonServiceImpl,
    dependencies: []
});
