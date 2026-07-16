import type React from "react";
import { Group, Select, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { ProjectDetailPresenter } from "../abstractions/ProjectDetailPresenter.js";
import { SCAN_INTERVALS } from "#shared/schedules/types.js";

interface ScanScheduleSectionProps {
    presenter: ProjectDetailPresenter.Interface;
}

const DEFAULT_OPTION_VALUE = "__default__";

const INTERVAL_LABELS: Record<string, string> = {
    "6h": "Every 6 hours",
    "12h": "Every 12 hours",
    "24h": "Every 24 hours",
    "48h": "Every 48 hours",
    weekly: "Weekly",
    disabled: "Disabled"
};

export const ScanScheduleSection = observer(function ScanScheduleSection({
    presenter
}: ScanScheduleSectionProps): React.ReactNode {
    const { vm } = presenter;

    if (!vm.schedule) {
        return null;
    }

    const options = [
        {
            value: DEFAULT_OPTION_VALUE,
            label: `Default (${INTERVAL_LABELS[vm.schedule.globalDefault] ?? vm.schedule.globalDefault})`
        },
        ...SCAN_INTERVALS.map(interval => ({
            value: interval,
            label: INTERVAL_LABELS[interval] ?? interval
        }))
    ];

    const currentValue =
        vm.schedule.source === "default" ? DEFAULT_OPTION_VALUE : vm.schedule.interval;

    const handleChange = async (value: string | null): Promise<void> => {
        if (!value) {
            return;
        }

        if (value === DEFAULT_OPTION_VALUE) {
            await presenter.resetSchedule();
        } else {
            await presenter.updateSchedule(value);
        }
    };

    return (
        <Stack gap="xs">
            <Text fw={500} size="sm">
                Scan Schedule
            </Text>
            <Group>
                <Select
                    data={options}
                    value={currentValue}
                    onChange={value => void handleChange(value)}
                    style={{ width: 250 }}
                />
            </Group>
        </Stack>
    );
});
