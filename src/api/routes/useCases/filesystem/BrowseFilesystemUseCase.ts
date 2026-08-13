import { readdir, realpath } from "fs/promises";
import { resolve, join } from "path";
import { Result } from "#shared/index.js";
import { BrowseFilesystemUseCase as Abstraction } from "./abstractions/BrowseFilesystemUseCase.js";

class BrowseFilesystemUseCaseImpl implements Abstraction.Interface {
    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const rawPath = params.path ?? process.cwd();
        const showHidden = params.showHidden === "true";

        let resolvedPath: string;
        try {
            resolvedPath = await realpath(resolve(rawPath));
        } catch {
            return Result.fail({ statusCode: 400, message: `Path does not exist: ${rawPath}` });
        }

        try {
            const entries = await readdir(resolvedPath, { withFileTypes: true });

            const directories = entries
                .filter(entry => entry.isDirectory())
                .filter(entry => showHidden || !entry.name.startsWith("."))
                .map(entry => ({
                    name: entry.name,
                    path: join(resolvedPath, entry.name),
                    type: "directory" as const
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            return Result.ok({
                items: directories,
                total: directories.length,
                currentPath: resolvedPath
            });
        } catch {
            return Result.fail({
                statusCode: 400,
                message: `Cannot read directory: ${resolvedPath}`
            });
        }
    }
}

export const BrowseFilesystemUseCase = Abstraction.createImplementation({
    implementation: BrowseFilesystemUseCaseImpl,
    dependencies: []
});
