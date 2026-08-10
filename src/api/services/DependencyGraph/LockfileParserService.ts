import { readFile } from "fs/promises";
import { join } from "path";
import { LockfileParserService as Abstraction } from "./abstractions/LockfileParserService.js";
import { parseNpmLockfile } from "./parsers/parseNpmLockfile.js";
import { parseYarnLockfile } from "./parsers/parseYarnLockfile.js";
import { parsePnpmLockfile } from "./parsers/parsePnpmLockfile.js";
import { parseBunLockfile } from "./parsers/parseBunLockfile.js";

const LOCKFILE_NAME_BY_PACKAGE_MANAGER: Record<string, string> = {
    npm: "package-lock.json",
    yarn: "yarn.lock",
    pnpm: "pnpm-lock.yaml",
    bun: "bun.lock"
};

const PARSER_BY_PACKAGE_MANAGER: Record<
    string,
    (lockfileContent: string, rootPackageJsonContent: string) => Abstraction.DependencyEdge[]
> = {
    npm: parseNpmLockfile,
    yarn: parseYarnLockfile,
    pnpm: parsePnpmLockfile,
    bun: parseBunLockfile
};

class LockfileParserServiceImpl implements Abstraction.Interface {
    public async parse(
        projectPath: string,
        packageManager: string
    ): Promise<Abstraction.DependencyEdge[]> {
        const lockfileName = LOCKFILE_NAME_BY_PACKAGE_MANAGER[packageManager];
        const parser = PARSER_BY_PACKAGE_MANAGER[packageManager];
        if (!lockfileName || !parser) {
            return [];
        }

        let lockfileContent: string;
        try {
            lockfileContent = await readFile(join(projectPath, lockfileName), "utf-8");
        } catch {
            return [];
        }

        let rootPackageJsonContent: string;
        try {
            rootPackageJsonContent = await readFile(join(projectPath, "package.json"), "utf-8");
        } catch {
            rootPackageJsonContent = "{}";
        }

        return parser(lockfileContent, rootPackageJsonContent);
    }
}

export const LockfileParserService = Abstraction.createImplementation({
    implementation: LockfileParserServiceImpl,
    dependencies: []
});
