import type React from "react";
import { useEffect, useState } from "react";
import { Select, Stack, Text } from "@mantine/core";
import { useContainer } from "../../../../infrastructure/Shared/di/ContainerProvider.js";
import { LoadScanSchedulesUseCase } from "../../../ScanSchedules/useCases/abstractions/LoadScanSchedulesUseCase.js";
import { UpdateScanScheduleDefaultUseCase } from "../../../ScanSchedules/useCases/abstractions/UpdateScanScheduleDefaultUseCase.js";
import { ScanSchedulesRepository } from "../../../../features/ScanSchedules/abstractions/ScanSchedulesRepository.js";
import { SCAN_INTERVALS } from "#shared/schedules/types.js";

const INTERVAL_LABELS: Record<string, string> = {
    "6h": "Every 6 hours",
    "12h": "Every 12 hours",
    "24h": "Every 24 hours",
    "48h": "Every 48 hours",
    weekly: "Weekly",
    disabled: "Disabled"
};

export function ScanScheduleDefaultSection(): React.ReactNode {
    const container = useContainer();
    const loadUseCase = container.resolve(LoadScanSchedulesUseCase);
    const updateUseCase = container.resolve(UpdateScanScheduleDefaultUseCase);
    const repository = container.resolve(ScanSchedulesRepository);
    const [value, setValue] = useState("disabled");

    useEffect(() => {
        void (async () => {
            await loadUseCase.execute();
            setValue(repository.getGlobalDefault());
        })();
    }, [loadUseCase, repository]);

    const handleChange = async (newValue: string | null): Promise<void> => {
        if (!newValue) {
            return;
        }
        await updateUseCase.execute(newValue);
        setValue(newValue);
    };

    return (
        <Stack gap="xs">
            <Text fw={500} size="sm">
                Default Scan Schedule
            </Text>
            <Text size="xs" c="dimmed">
                How often to automatically scan all projects for dependency updates.
            </Text>
            <Select
                data={SCAN_INTERVALS.map(interval => ({
                    value: interval,
                    label: INTERVAL_LABELS[interval] ?? interval
                }))}
                value={value}
                onChange={value => void handleChange(value)}
                style={{ width: 250 }}
            />
        </Stack>
    );
}
