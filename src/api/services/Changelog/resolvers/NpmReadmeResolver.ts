import { ChangelogResolver as Abstraction } from "../abstractions/ChangelogResolver.js";
import { RegistryCacheService } from "../../RegistryCache/index.js";
import { parseVersionSections } from "../parseVersionSections.js";

class NpmReadmeResolverImpl implements Abstraction.Interface {
    public readonly name = "npm-readme";

    public constructor(private readonly registryCacheService: RegistryCacheService.Interface) {}

    public async resolve(
        packageName: string,
        _repoUrl: string | null,
        versions: string[],
        _repoDirectory?: string | null
    ): Promise<Map<string, string>> {
        let readme: string | null;
        try {
            const info = await this.registryCacheService.getPackageInfo(packageName, "npm");
            readme = info.readme;
        } catch {
            return new Map();
        }

        if (!readme) {
            return new Map();
        }

        try {
            return parseVersionSections(readme, new Set(versions));
        } catch {
            return new Map();
        }
    }
}

export const NpmReadmeResolver = Abstraction.createImplementation({
    implementation: NpmReadmeResolverImpl,
    dependencies: [RegistryCacheService]
});
