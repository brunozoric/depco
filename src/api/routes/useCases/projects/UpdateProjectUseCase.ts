import { existsSync } from "fs";
import { join } from "path";
import { eq, and, ne } from "drizzle-orm";
import { Result, unexpectedError } from "#shared/index.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { projects } from "#api/db/schema.js";
import { UpdateProjectUseCase as Abstraction } from "./abstractions/UpdateProjectUseCase.js";

class UpdateProjectUseCaseImpl implements Abstraction.Interface {
    public constructor(private readonly databaseClient: DatabaseClient.Interface) {}

    public async execute(
        params: Abstraction.Params
    ): Promise<Result<Abstraction.Data, Abstraction.Error>> {
        try {
            const { db } = this.databaseClient;
            const trimmedName = params.name.trim();

            const existing = db.select().from(projects).where(eq(projects.id, params.id)).get();
            if (!existing) {
                return Result.fail({
                    code: "PROJECT_NOT_FOUND",
                    statusCode: 404,
                    message: `Project ${params.id} not found`
                });
            }

            const duplicate = db
                .select()
                .from(projects)
                .where(and(eq(projects.name, trimmedName), ne(projects.id, params.id)))
                .get();

            if (duplicate) {
                return Result.fail({
                    code: "NAME_ALREADY_EXISTS",
                    statusCode: 409,
                    message: `A project named "${trimmedName}" already exists`
                });
            }

            db.update(projects).set({ name: trimmedName }).where(eq(projects.id, params.id)).run();

            const updated = db.select().from(projects).where(eq(projects.id, params.id)).get()!;

            return Result.ok({
                id: updated.id,
                name: updated.name,
                path: updated.path,
                packageManager: updated.packageManager,
                pmVersion: updated.pmVersion,
                addedAt: updated.addedAt,
                lastScannedAt: updated.lastScannedAt,
                hasNodeModules: existsSync(join(updated.path, "node_modules")),
                engineStatus: updated.engineStatus ?? null,
                rootEnginesNode: updated.rootEnginesNode ?? null
            });
        } catch (error) {
            return Result.fail(unexpectedError(error));
        }
    }
}

export const UpdateProjectUseCase = Abstraction.createImplementation({
    implementation: UpdateProjectUseCaseImpl,
    dependencies: [DatabaseClient]
});
