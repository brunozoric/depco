import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { createTestApiContainer } from "#testing/helpers/createTestApiContainer.js";
import { projects, projectStepHooks } from "#api/db/schema.js";
import { StepHookService } from "../abstractions/StepHookService.js";

type TestDb = ReturnType<typeof createTestApiContainer>["db"];

describe("StepHookService", () => {
    let db: TestDb;
    let service: StepHookService.Interface;

    beforeEach(async () => {
        const { container, db: testDb } = createTestApiContainer();
        db = testDb;

        await db
            .insert(projects)
            .values({
                id: "p1",
                name: "test-project",
                path: "/tmp/test-project",
                packageManager: "yarn",
                addedAt: Date.now()
            })
            .run();

        service = container.resolve(StepHookService);
    });

    it("returns empty config when no hooks defined", async () => {
        const config = await service.getStepConfig("p1", "/tmp/test-project");
        expect(config).toEqual([]);
    });

    it("returns DB hooks ordered by position and sortOrder", async () => {
        const now = Date.now();
        await db
            .insert(projectStepHooks)
            .values([
                {
                    id: "h1",
                    projectId: "p1",
                    position: "pre:upgrade",
                    name: "Lint",
                    command: "eslint .",
                    type: "command",
                    required: 1,
                    enabled: 1,
                    sortOrder: 0,
                    source: "db",
                    createdAt: now,
                    updatedAt: now
                },
                {
                    id: "h2",
                    projectId: "p1",
                    position: "post:commit",
                    name: "Notify",
                    command: "./scripts/notify.sh",
                    type: "script",
                    required: 0,
                    enabled: 1,
                    sortOrder: 0,
                    source: "db",
                    createdAt: now,
                    updatedAt: now
                }
            ])
            .run();

        const config = await service.getStepConfig("p1", "/tmp/test-project");
        expect(config).toHaveLength(2);
        // Ordered by position ASC: "post:commit" < "pre:upgrade" alphabetically
        expect(config[0]).toEqual(
            expect.objectContaining({
                position: "post:commit",
                name: "Notify",
                command: "./scripts/notify.sh",
                executionType: "script",
                required: false
            })
        );
        expect(config[1]).toEqual(
            expect.objectContaining({
                position: "pre:upgrade",
                name: "Lint",
                command: "eslint .",
                executionType: "command",
                required: true
            })
        );
    });

    it("filters out disabled hooks", async () => {
        const now = Date.now();
        await db
            .insert(projectStepHooks)
            .values({
                id: "h1",
                projectId: "p1",
                position: "pre:upgrade",
                name: "Disabled",
                command: "echo nope",
                type: "command",
                required: 0,
                enabled: 0,
                sortOrder: 0,
                source: "db",
                createdAt: now,
                updatedAt: now
            })
            .run();

        const config = await service.getStepConfig("p1", "/tmp/test-project");
        expect(config).toEqual([]);
    });

    describe("with file config", () => {
        let tempDir: string;

        beforeEach(async () => {
            tempDir = await mkdtemp(join(tmpdir(), "dep-upgrader-stephook-"));
        });

        afterEach(async () => {
            await rm(tempDir, { recursive: true, force: true });
        });

        it("returns file hooks when config file exists, ignoring DB hooks", async () => {
            // Insert a DB hook
            const now = Date.now();
            await db
                .insert(projectStepHooks)
                .values({
                    id: "h1",
                    projectId: "p1",
                    position: "pre:upgrade",
                    name: "DB Hook",
                    command: "echo db",
                    type: "command",
                    required: 0,
                    enabled: 1,
                    sortOrder: 0,
                    source: "db",
                    createdAt: now,
                    updatedAt: now
                })
                .run();

            // Write config file
            await writeFile(
                join(tempDir, ".dependency-upgrader.json"),
                JSON.stringify({
                    stepHooks: [
                        {
                            position: "pre:upgrade",
                            name: "File Hook",
                            command: "yarn lint",
                            executionType: "command",
                            required: true
                        }
                    ]
                }),
                "utf-8"
            );

            const config = await service.getStepConfig("p1", tempDir);
            expect(config).toHaveLength(1);
            expect(config[0]).toEqual(
                expect.objectContaining({
                    name: "File Hook",
                    command: "yarn lint",
                    source: "file"
                })
            );
        });

        it("falls back to DB hooks when no config file", async () => {
            const now = Date.now();
            await db
                .insert(projectStepHooks)
                .values({
                    id: "h1",
                    projectId: "p1",
                    position: "pre:upgrade",
                    name: "DB Hook",
                    command: "echo db",
                    type: "command",
                    required: 1,
                    enabled: 1,
                    sortOrder: 0,
                    source: "db",
                    createdAt: now,
                    updatedAt: now
                })
                .run();

            const config = await service.getStepConfig("p1", tempDir);
            expect(config).toHaveLength(1);
            expect(config[0]).toEqual(
                expect.objectContaining({
                    name: "DB Hook",
                    source: "db"
                })
            );
        });
    });
});
