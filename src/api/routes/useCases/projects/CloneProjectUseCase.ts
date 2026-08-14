import { access } from "fs/promises";
import { join } from "path";
import { eq } from "drizzle-orm";
import { Result } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { JobWorker } from "#api/services/JobExecution/index.js";
import { projects } from "#api/db/schema.js";
import { CloneProjectUseCase as Abstraction } from "./abstractions/CloneProjectUseCase.js";

function extractRepoName(url: string): string | null {
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    if (match) {
        return match[1]!;
    }
    const sshMatch = url.match(/:([^/]+?)(?:\.git)?$/);
    return sshMatch?.[1] ?? null;
}

class CloneProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(
        private readonly databaseClient: DatabaseClient.Interface,
        private readonly jobWorker: JobWorker.Interface
    ) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        const { url, destination, folderName } = params;

        if (!url.startsWith("https://") && !url.startsWith("git@")) {
            return Result.fail({
                code: "INVALID_URL",
                statusCode: 400,
                message: "Only https:// and git@ URLs are supported"
            });
        }

        const repoName = extractRepoName(url);
        if (!repoName) {
            return Result.fail({
                code: "REPO_NAME_EXTRACTION_FAILED",
                statusCode: 400,
                message: "Could not extract repository name from URL"
            });
        }

        const finalFolderName = folderName || repoName;
        if (
            finalFolderName.includes("/") ||
            finalFolderName.includes("\\") ||
            finalFolderName.includes("..")
        ) {
            return Result.fail({
                code: "INVALID_FOLDER_NAME",
                statusCode: 400,
                message: "Folder name must not contain path separators or '..'"
            });
        }

        try {
            await access(destination);
        } catch {
            return Result.fail({
                code: "DESTINATION_NOT_FOUND",
                statusCode: 400,
                message: `Destination directory does not exist: ${destination}`
            });
        }

        const finalPath = join(destination, finalFolderName);

        let existing;
        try {
            existing = await this.databaseClient.db
                .select()
                .from(projects)
                .where(eq(projects.path, finalPath))
                .get();
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }

        if (existing) {
            return Result.fail({
                code: "PROJECT_ALREADY_REGISTERED",
                statusCode: 409,
                message: `A project is already registered at ${finalPath}`
            });
        }

        try {
            const jobId = await this.jobWorker.enqueue({
                referenceId: finalPath,
                referenceType: "project",
                type: "clone",
                packages: JSON.stringify({ url, destination: finalPath })
            });

            return Result.ok({ jobId });
        } catch (error) {
            return Result.fail({
                code: "UNEXPECTED_ERROR",
                statusCode: 500,
                message: (error as Error).message
            });
        }
    }
}

export const CloneProjectUseCase = Abstraction.createImplementation({
    implementation: CloneProjectUseCaseImpl,
    dependencies: [DatabaseClient, JobWorker]
});
