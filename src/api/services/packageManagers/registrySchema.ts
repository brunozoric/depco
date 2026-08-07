import { z } from "zod";
import { normalizeRepoUrl, extractRepoDirectory } from "./normalizeRepoUrl.js";
import { parseLicense } from "./parseLicense.js";
import type { IRegistryPackageInfo } from "./abstractions/PackageManagerDriver.js";

const registryOutputSchema = z
    .object({
        "dist-tags": z.record(z.string(), z.string()).optional().default({}),
        versions: z.array(z.string()).optional().default([]),
        time: z.record(z.string(), z.string()).optional().default({}),
        repository: z.unknown().optional(),
        readme: z.string().optional(),
        license: z.unknown().optional()
    })
    .passthrough();

export function parseRegistryOutput(stdout: string): IRegistryPackageInfo {
    const raw = registryOutputSchema.parse(JSON.parse(stdout));
    return {
        name: "",
        latestVersion: raw["dist-tags"]["latest"] ?? "",
        distTags: raw["dist-tags"],
        versions: raw.versions,
        time: raw.time,
        repoUrl: normalizeRepoUrl(raw.repository),
        repoDirectory: extractRepoDirectory(raw.repository),
        readme: raw.readme ?? null,
        license: parseLicense(raw.license)
    };
}
