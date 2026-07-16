import { describe, it, expect } from "vitest";
import { ScanSchedulesRepositoryImpl } from "../ScanSchedulesRepository.js";

function createRepo(): ScanSchedulesRepositoryImpl {
    return new ScanSchedulesRepositoryImpl();
}

describe("ScanSchedulesRepository", () => {
    it("stores and retrieves schedules", () => {
        const repo = createRepo();
        const schedule = {
            projectId: "p1",
            projectName: "test",
            interval: "24h",
            source: "default" as const,
            lastRunAt: null,
            nextRunAt: null
        };

        repo.setSchedules([schedule]);
        expect(repo.getSchedules()).toEqual([schedule]);
    });

    it("retrieves a single schedule by projectId", () => {
        const repo = createRepo();
        repo.setSchedules([
            {
                projectId: "p1",
                projectName: "a",
                interval: "6h",
                source: "project",
                lastRunAt: null,
                nextRunAt: null
            },
            {
                projectId: "p2",
                projectName: "b",
                interval: "24h",
                source: "default",
                lastRunAt: null,
                nextRunAt: null
            }
        ]);

        expect(repo.getSchedule("p2")?.interval).toBe("24h");
    });

    it("updates a schedule in place", () => {
        const repo = createRepo();
        repo.setSchedules([
            {
                projectId: "p1",
                projectName: "a",
                interval: "24h",
                source: "default",
                lastRunAt: null,
                nextRunAt: null
            }
        ]);

        repo.updateSchedule("p1", "6h", "project");
        expect(repo.getSchedule("p1")?.interval).toBe("6h");
        expect(repo.getSchedule("p1")?.source).toBe("project");
    });

    it("stores and retrieves global default", () => {
        const repo = createRepo();
        expect(repo.getGlobalDefault()).toBe("disabled");
        repo.setGlobalDefault("24h");
        expect(repo.getGlobalDefault()).toBe("24h");
    });
});
