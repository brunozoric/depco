import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createContainer } from "#shared/index.js";
import { ChangelogJobExecutor } from "../abstractions/ChangelogJobExecutor.js";
import { ChangelogJobExecutor as ChangelogJobExecutorRegistration } from "../ChangelogJobExecutor.js";
import type { JobExecutor } from "../abstractions/JobExecutor.js";
import { DatabaseClient } from "#api/db/abstractions/DatabaseClient.js";
import { WebSocketBroadcaster } from "#api/websocket/abstractions/WebSocketBroadcaster.js";
import { createTestDb } from "#testing/helpers/createTestDb.js";
import { dependencies, dependencyVersions, changelogs } from "#api/db/schema.js";

function createMockContext(packages: object): JobExecutor.ExecutionContext {
    return {
        jobId: "job-1",
        referenceId: "@test/pkg",
        projectPath: "",
        packageManager: "",
        packagesJson: JSON.stringify(packages),
        project: null,
        appendLog: vi.fn(),
        setProgress: vi.fn(),
        signal: new AbortController().signal
    };
}

function createExecutor(
    db: DatabaseClient.Interface,
    broadcaster: WebSocketBroadcaster.Interface
): JobExecutor.Interface {
    const container = createContainer();
    container.registerInstance(DatabaseClient, db);
    container.registerInstance(WebSocketBroadcaster, broadcaster);
    container.register(ChangelogJobExecutorRegistration);
    return container.resolve(ChangelogJobExecutor);
}

describe("ChangelogJobExecutor", () => {
    it("has type 'changelog'", () => {
        const executor = createExecutor(
            {} as DatabaseClient.Interface,
            {} as WebSocketBroadcaster.Interface
        );
        expect(executor.type).toBe("changelog");
    });

    it("broadcasts changelog:resolved for each version found", async () => {
        const db = await createTestDb();

        await db
            .insert(dependencies)
            .values({
                id: "dep-1",
                name: "left-pad",
                repoUrl: "https://github.com/example/left-pad",
                createdAt: Date.now()
            })
            .run();

        await db
            .insert(dependencyVersions)
            .values([
                { id: "ver-1", dependencyId: "dep-1", version: "1.1.0" },
                { id: "ver-2", dependencyId: "dep-1", version: "1.2.0" }
            ])
            .run();

        await db
            .insert(changelogs)
            .values([
                { id: "cl-1", dependencyId: "dep-1", dependencyVersionId: "ver-1" },
                { id: "cl-2", dependencyId: "dep-1", dependencyVersionId: "ver-2" }
            ])
            .run();

        // No resolvers registered — every unfetched version falls through with
        // no content found, exercising the "none" source / broadcast path.
        const broadcaster: WebSocketBroadcaster.Interface = {
            broadcast: vi.fn(),
            addClient: vi.fn(),
            removeClient: vi.fn()
        };

        const executor = createExecutor({ db }, broadcaster);

        await executor.execute(
            createMockContext({ packageName: "left-pad", from: "1.0.0", to: "1.2.0" })
        );

        const broadcastSpy = broadcaster.broadcast as ReturnType<typeof vi.fn>;
        const calls = broadcastSpy.mock.calls.filter(c => c[0] === "changelog:resolved");
        expect(calls).toHaveLength(2);

        const versionsBroadcast = calls.map(c => c[1].version).sort();
        expect(versionsBroadcast).toEqual(["1.1.0", "1.2.0"]);

        for (const [, payload] of calls) {
            expect(payload).toEqual(
                expect.objectContaining({ packageName: "left-pad", source: "none" })
            );
        }

        const rows = await db
            .select()
            .from(changelogs)
            .where(eq(changelogs.dependencyId, "dep-1"))
            .all();
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row.source).toBe("none");
            expect(row.fetchedAt).not.toBeNull();
        }
    });
});
