import { ParseLockfileStep as Abstraction } from "./abstractions/ParseLockfileStep.js";
import { LockfileParserService } from "#api/services/DependencyGraph/abstractions/LockfileParserService.js";
import type { IStepContext, IStepResult } from "../../../../runner/abstractions/Step.js";

interface IPackageEntry {
    name: string;
    version: string;
}

class ParseLockfileStepImpl implements Abstraction.Interface {
    public name = "parse-lockfile";
    public description = "Parse lockfile to extract package list";

    public constructor(private readonly lockfileParser: LockfileParserService.Interface) {}

    public async execute(context: IStepContext): Promise<IStepResult> {
        const packageManager = context.results.get("packageManager") as string;
        const edges = await this.lockfileParser.parse(context.dataDirectory, packageManager);

        const seen = new Set<string>();
        const packages: IPackageEntry[] = [];

        for (const edge of edges) {
            const key = `${edge.childPackage}@${edge.childVersion}`;
            if (!seen.has(key)) {
                seen.add(key);
                packages.push({ name: edge.childPackage, version: edge.childVersion });
            }
        }

        if (packages.length === 0) {
            return { success: false, message: "No packages found in lockfile" };
        }

        context.results.set("packages", packages);
        return { success: true, message: `Found ${packages.length} packages` };
    }
}

export const ParseLockfileStep = Abstraction.createImplementation({
    implementation: ParseLockfileStepImpl,
    dependencies: [LockfileParserService]
});
