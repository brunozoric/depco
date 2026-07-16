import { describe, it, expect, vi } from "vitest";
import { createContainer } from "#shared/index.js";
import { ScanSchedulesGateway } from "../../../../features/scanSchedules/abstractions/ScanSchedulesGateway.js";
import { ScanSchedulesRepository } from "../../../../features/scanSchedules/abstractions/ScanSchedulesRepository.js";
import { ScanSchedulesRepositoryImpl } from "../../../../features/scanSchedules/ScanSchedulesRepository.js";
import { LoadScanSchedulesUseCase as LoadAbstraction } from "../abstractions/LoadScanSchedulesUseCase.js";
import { LoadScanSchedulesUseCase } from "../LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleUseCase as UpdateAbstraction } from "../abstractions/UpdateScanScheduleUseCase.js";
import { UpdateScanScheduleUseCase } from "../UpdateScanScheduleUseCase.js";
import { ResetScanScheduleUseCase as ResetAbstraction } from "../abstractions/ResetScanScheduleUseCase.js";
import { ResetScanScheduleUseCase } from "../ResetScanScheduleUseCase.js";
import { UpdateScanScheduleDefaultUseCase as DefaultAbstraction } from "../abstractions/UpdateScanScheduleDefaultUseCase.js";
import { UpdateScanScheduleDefaultUseCase } from "../UpdateScanScheduleDefaultUseCase.js";

interface TestContext {
    gateway: ScanSchedulesGateway.Interface;
    repository: ScanSchedulesRepositoryImpl;
    loadUseCase: LoadAbstraction.Interface;
    updateUseCase: UpdateAbstraction.Interface;
    resetUseCase: ResetAbstraction.Interface;
    defaultUseCase: DefaultAbstraction.Interface;
}

function createContext(): TestContext {
    const gateway: ScanSchedulesGateway.Interface = {
        list: vi.fn().mockResolvedValue({
            items: [
                {
                    projectId: "p1",
                    projectName: "test",
                    interval: "24h",
                    source: "default",
                    lastRunAt: null,
                    nextRunAt: null
                }
            ],
            globalDefault: "24h"
        }),
        upsert: vi.fn().mockResolvedValue({
            id: "s1",
            projectId: "p1",
            interval: "6h",
            lastRunAt: null,
            nextRunAt: null,
            enabled: true,
            createdAt: 0,
            updatedAt: 0
        }),
        remove: vi.fn(),
        getDefault: vi.fn().mockResolvedValue("24h"),
        setDefault: vi.fn().mockResolvedValue("12h")
    };

    const container = createContainer();
    container.registerInstance(ScanSchedulesGateway, gateway);
    container.register(LoadScanSchedulesUseCase).inSingletonScope();
    container.register(UpdateScanScheduleUseCase).inSingletonScope();
    container.register(ResetScanScheduleUseCase).inSingletonScope();
    container.register(UpdateScanScheduleDefaultUseCase).inSingletonScope();

    const repository = new ScanSchedulesRepositoryImpl();
    container.registerInstance(ScanSchedulesRepository, repository);

    return {
        gateway,
        repository,
        loadUseCase: container.resolve(LoadAbstraction),
        updateUseCase: container.resolve(UpdateAbstraction),
        resetUseCase: container.resolve(ResetAbstraction),
        defaultUseCase: container.resolve(DefaultAbstraction)
    };
}

describe("scan schedule use cases", () => {
    it("LoadScanSchedulesUseCase populates repository", async () => {
        const { loadUseCase, repository } = createContext();
        await loadUseCase.execute();
        expect(repository.getSchedules()).toHaveLength(1);
        expect(repository.getGlobalDefault()).toBe("24h");
    });

    it("UpdateScanScheduleUseCase calls gateway and updates repository", async () => {
        const { updateUseCase, repository, gateway } = createContext();
        repository.setSchedules([
            {
                projectId: "p1",
                projectName: "test",
                interval: "24h",
                source: "default",
                lastRunAt: null,
                nextRunAt: null
            }
        ]);

        await updateUseCase.execute("p1", "6h");
        expect(gateway.upsert).toHaveBeenCalledWith("p1", "6h");
        expect(repository.getSchedule("p1")?.interval).toBe("6h");
    });

    it("ResetScanScheduleUseCase calls gateway remove and resets source", async () => {
        const { resetUseCase, repository, gateway } = createContext();
        repository.setSchedules([
            {
                projectId: "p1",
                projectName: "test",
                interval: "6h",
                source: "project",
                lastRunAt: null,
                nextRunAt: null
            }
        ]);
        repository.setGlobalDefault("24h");

        await resetUseCase.execute("p1");
        expect(gateway.remove).toHaveBeenCalledWith("p1");
        expect(repository.getSchedule("p1")?.interval).toBe("24h");
        expect(repository.getSchedule("p1")?.source).toBe("default");
    });

    it("UpdateScanScheduleDefaultUseCase sets global default", async () => {
        const { defaultUseCase, repository, gateway } = createContext();
        await defaultUseCase.execute("12h");
        expect(gateway.setDefault).toHaveBeenCalledWith("12h");
        expect(repository.getGlobalDefault()).toBe("12h");
    });
});
