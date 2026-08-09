import type React from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    Stack,
    Title,
    Group,
    Table,
    Text,
    TextInput,
    ColorInput,
    MultiSelect,
    Button,
    Modal,
    Skeleton,
    ActionIcon
} from "@mantine/core";
import type { TeamsPresenter } from "../abstractions/TeamsPresenter.js";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";
import { navigate } from "#ui/infrastructure/Shared/router/router.js";

interface TeamsPageProps {
    presenter: TeamsPresenter.Interface;
}

export const TeamsPage = observer(function TeamsPage({
    presenter
}: TeamsPageProps): React.ReactNode {
    const [savingTeam, setSavingTeam] = useState(false);

    useEffect(() => {
        void presenter.load();
    }, [presenter]);

    const { vm } = presenter;

    if (vm.loading && vm.teams.length === 0) {
        return (
            <Stack>
                <Title order={2}>Teams</Title>
                <Skeleton height={40} />
                <Skeleton height={300} />
            </Stack>
        );
    }

    if (vm.error) {
        return (
            <Stack>
                <Title order={2}>Teams</Title>
                <Text c="red">{vm.error}</Text>
            </Stack>
        );
    }

    async function handleSaveTeam(): Promise<void> {
        setSavingTeam(true);
        try {
            await presenter.saveTeam();
        } finally {
            setSavingTeam(false);
        }
    }

    return (
        <Stack>
            <Title order={2}>Teams</Title>

            {vm.mutationError && <Text c="red">{vm.mutationError}</Text>}

            <Group justify="flex-end">
                <Button onClick={() => presenter.openCreateModal()}>Add Team</Button>
            </Group>

            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th />
                        <Table.Th>Name</Table.Th>
                        <Table.Th>Projects</Table.Th>
                        <Table.Th>Vulnerabilities</Table.Th>
                        <Table.Th>Compliance</Table.Th>
                        <Table.Th>Health Score</Table.Th>
                        <Table.Th />
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {vm.teams.map(team => (
                        <Table.Tr key={team.id}>
                            <Table.Td>
                                <div
                                    style={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: "50%",
                                        backgroundColor: team.color
                                    }}
                                />
                            </Table.Td>
                            <Table.Td>
                                <Text
                                    style={{ cursor: "pointer", textDecoration: "underline" }}
                                    onClick={() => navigate(`/teams/${team.id}`)}
                                >
                                    {team.name}
                                </Text>
                            </Table.Td>
                            <Table.Td>{team.projectCount}</Table.Td>
                            <Table.Td>{team.vulnerabilityCount}</Table.Td>
                            <Table.Td>{team.compliantPercent}%</Table.Td>
                            <Table.Td>{team.averageHealthScore}</Table.Td>
                            <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                    <ActionIcon
                                        variant="subtle"
                                        onClick={() => presenter.openEditModal(team)}
                                    >
                                        ✎
                                    </ActionIcon>
                                    <ActionIcon
                                        variant="subtle"
                                        color="red"
                                        onClick={() => presenter.confirmDelete(team.id)}
                                    >
                                        ✕
                                    </ActionIcon>
                                </Group>
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>

            <Modal
                opened={vm.editingTeam !== null}
                onClose={() => presenter.closeModal()}
                title={vm.editingTeam?.id ? "Edit Team" : "Add Team"}
            >
                <Stack>
                    <TextInput
                        label="Name"
                        value={vm.editingTeam?.name ?? ""}
                        onChange={event => presenter.setFormName(event.currentTarget.value)}
                    />
                    <ColorInput
                        label="Color"
                        value={vm.editingTeam?.color ?? ""}
                        onChange={value => presenter.setFormColor(value)}
                    />
                    <MultiSelect
                        label="Projects"
                        placeholder="Select projects"
                        data={vm.availableProjects}
                        value={vm.editingTeam?.projectIds ?? []}
                        onChange={value => presenter.setFormProjects(value)}
                        searchable
                        clearable
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={() => presenter.closeModal()}>
                            Cancel
                        </Button>
                        <Button loading={savingTeam} onClick={() => void handleSaveTeam()}>
                            Save
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <ConfirmDialog
                opened={vm.deletingTeamId !== null}
                title="Delete Team"
                message="Delete this team? This cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => void presenter.deleteTeam()}
                onCancel={() => presenter.cancelDelete()}
            />
        </Stack>
    );
});
