import { readdir, access } from "fs/promises";
import { join } from "path";

const SKIP_DIRECTORIES = new Set(["node_modules", ".git"]);

export async function globWorkspacePattern(root: string, pattern: string): Promise<string[]> {
    const segments = pattern.split("/").filter(Boolean);

    async function resolveSegments(
        baseAbs: string,
        baseRel: string,
        remaining: string[]
    ): Promise<string[]> {
        if (remaining.length === 0) {
            try {
                await access(join(baseAbs, "package.json"));
                return [baseRel];
            } catch {
                return [];
            }
        }

        const [segment, ...rest] = remaining;

        if (segment === "**") {
            const results = await resolveSegments(baseAbs, baseRel, rest);
            let entries;
            try {
                entries = await readdir(baseAbs, { withFileTypes: true });
            } catch {
                return results;
            }
            for (const entry of entries) {
                if (
                    !entry.isDirectory() ||
                    SKIP_DIRECTORIES.has(entry.name) ||
                    entry.name.startsWith(".")
                ) {
                    continue;
                }
                const childRel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
                results.push(
                    ...(await resolveSegments(join(baseAbs, entry.name), childRel, remaining))
                );
            }
            return results;
        }

        if (segment === "*") {
            let entries;
            try {
                entries = await readdir(baseAbs, { withFileTypes: true });
            } catch {
                return [];
            }
            const results: string[] = [];
            for (const entry of entries) {
                if (
                    !entry.isDirectory() ||
                    SKIP_DIRECTORIES.has(entry.name) ||
                    entry.name.startsWith(".")
                ) {
                    continue;
                }
                const childRel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
                results.push(...(await resolveSegments(join(baseAbs, entry.name), childRel, rest)));
            }
            return results;
        }

        const childRel = baseRel ? `${baseRel}/${segment}` : (segment as string);
        return resolveSegments(join(baseAbs, segment as string), childRel, rest);
    }

    return resolveSegments(root, "", segments);
}
