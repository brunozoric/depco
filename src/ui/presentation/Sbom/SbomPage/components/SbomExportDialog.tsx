import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
    Modal,
    Stack,
    Text,
    SegmentedControl,
    Select,
    Group,
    Button,
    Skeleton
} from "@mantine/core";
import type { SbomPresenter } from "../abstractions/SbomPresenter.js";

interface SbomExportDialogProps {
    opened: boolean;
    onClose: () => void;
    presenter: SbomPresenter.Interface;
}

const FORMAT_OPTIONS = [
    { value: "cyclonedx", label: "CycloneDX" },
    { value: "spdx", label: "SPDX" }
];

export const SbomExportDialog = observer(function SbomExportDialog({
    opened,
    onClose,
    presenter
}: SbomExportDialogProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        if (opened) {
            void presenter.load();
        }
    }, [opened, presenter]);

    return (
        <Modal opened={opened} onClose={onClose} title="Export SBOM" size="md">
            <Stack gap="md">
                <Text size="sm" c="dimmed">
                    A Software Bill of Materials (SBOM) is a formal inventory of all components,
                    libraries, and dependencies in your software. Organizations use SBOMs to track
                    supply chain risks, meet regulatory compliance requirements, and quickly
                    identify affected projects when new vulnerabilities are disclosed.
                </Text>

                {vm.loading ? (
                    <Skeleton height={120} />
                ) : (
                    <>
                        {vm.error && (
                            <Text c="red" size="sm">
                                {vm.error}
                            </Text>
                        )}

                        <Stack gap="xs">
                            <Text size="sm" fw={600}>
                                Format
                            </Text>
                            <SegmentedControl
                                value={vm.selectedFormat}
                                onChange={value => presenter.setSelectedFormat(value)}
                                data={FORMAT_OPTIONS}
                            />
                        </Stack>

                        <Stack gap="xs">
                            <Text size="sm" fw={600}>
                                Project
                            </Text>
                            <Select
                                placeholder="All projects"
                                clearable
                                searchable
                                value={vm.selectedProjectId}
                                onChange={value => presenter.setSelectedProjectId(value)}
                                data={vm.availableProjects.map(project => ({
                                    value: project.id,
                                    label: project.name
                                }))}
                            />
                        </Stack>

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
                    </>
                )}
            </Stack>
        </Modal>
    );
});
