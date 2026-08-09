import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
    Stack,
    Title,
    Group,
    Select,
    SegmentedControl,
    Button,
    Text,
    Card,
    Skeleton
} from "@mantine/core";
import type { SbomPresenter } from "../abstractions/SbomPresenter.js";

interface SbomPageProps {
    presenter: SbomPresenter.Interface;
}

const FORMAT_OPTIONS = [
    { value: "cyclonedx", label: "CycloneDX" },
    { value: "spdx", label: "SPDX" }
];

export const SbomPage = observer(function SbomPage({ presenter }: SbomPageProps): React.ReactNode {
    useEffect(() => {
        void presenter.load();
    }, [presenter]);

    const { vm } = presenter;

    if (vm.loading) {
        return (
            <Stack>
                <Title order={2}>SBOM Export</Title>
                <Skeleton height={200} />
            </Stack>
        );
    }

    return (
        <Stack>
            <Title order={2}>SBOM Export</Title>

            {vm.error && <Text c="red">{vm.error}</Text>}

            <Card withBorder padding="lg">
                <Stack>
                    <Text fw={600}>Format</Text>
                    <SegmentedControl
                        value={vm.selectedFormat}
                        onChange={value => presenter.setSelectedFormat(value)}
                        data={FORMAT_OPTIONS}
                    />

                    <Text fw={600}>Project</Text>
                    <Select
                        placeholder="Select a project"
                        clearable
                        searchable
                        value={vm.selectedProjectId}
                        onChange={value => presenter.setSelectedProjectId(value)}
                        data={vm.availableProjects.map(project => ({
                            value: project.id,
                            label: project.name
                        }))}
                    />

                    <Group>
                        <Button
                            loading={vm.exporting}
                            disabled={!vm.canExportProject}
                            onClick={() => void presenter.exportProject()}
                        >
                            Export Project
                        </Button>
                        <Button
                            variant="light"
                            loading={vm.exporting}
                            onClick={() => void presenter.exportAll()}
                        >
                            Export All Projects
                        </Button>
                    </Group>
                </Stack>
            </Card>
        </Stack>
    );
});
