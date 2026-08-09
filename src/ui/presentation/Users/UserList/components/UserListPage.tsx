import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
    Stack,
    Title,
    Group,
    Table,
    Badge,
    Text,
    TextInput,
    PasswordInput,
    Select,
    Button,
    Modal,
    Skeleton,
    ActionIcon,
    Pagination
} from "@mantine/core";
import type { UserListPresenter } from "../abstractions/UserListPresenter.js";
import { ConfirmDialog } from "#ui/infrastructure/Shared/components/ConfirmDialog.js";
import { SortableHeader } from "#ui/infrastructure/Shared/components/SortableHeader.js";
import { USER_PERMISSIONS } from "#shared/users/index.js";
import type { UserPermission } from "#shared/users/index.js";

interface UserListPageProps {
    presenter: UserListPresenter.Interface;
}

const PERMISSION_SELECT_DATA = USER_PERMISSIONS.map(permission => ({
    value: permission,
    label: permission === "full" ? "Full" : "Read-only"
}));

export const UserListPage = observer(function UserListPage({
    presenter
}: UserListPageProps): React.ReactNode {
    useEffect(() => {
        void presenter.load();
        return () => presenter.dispose();
    }, [presenter]);

    const { vm } = presenter;

    if (vm.loading && vm.users.length === 0) {
        return (
            <Stack>
                <Title order={2}>Users</Title>
                <Skeleton height={40} />
                <Skeleton height={300} />
            </Stack>
        );
    }

    if (vm.error) {
        return (
            <Stack>
                <Title order={2}>Users</Title>
                <Text c="red">{vm.error}</Text>
            </Stack>
        );
    }

    return (
        <Stack>
            <Group justify="space-between">
                <Title order={2}>Users</Title>
                {vm.canManage && (
                    <Button onClick={() => presenter.openCreateModal()}>Add User</Button>
                )}
            </Group>

            {vm.mutationError && <Text c="red">{vm.mutationError}</Text>}

            <TextInput
                placeholder="Search by email or name"
                value={vm.search}
                onChange={event => presenter.setSearch(event.currentTarget.value)}
            />

            <Table striped highlightOnHover>
                <Table.Thead>
                    <Table.Tr>
                        <Table.Th>
                            <SortableHeader
                                label="Email"
                                sortKey="email"
                                currentSortBy={vm.sortBy}
                                currentSortOrder={vm.sortOrder}
                                onSort={presenter.setSortBy}
                            />
                        </Table.Th>
                        <Table.Th>
                            <SortableHeader
                                label="Name"
                                sortKey="displayName"
                                currentSortBy={vm.sortBy}
                                currentSortOrder={vm.sortOrder}
                                onSort={presenter.setSortBy}
                            />
                        </Table.Th>
                        <Table.Th>Permission</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th />
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {vm.users.map(user => (
                        <Table.Tr key={user.id}>
                            <Table.Td>{user.email}</Table.Td>
                            <Table.Td>{user.displayName}</Table.Td>
                            <Table.Td>
                                <Badge color={user.permission === "full" ? "blue" : "gray"}>
                                    {user.permission === "full" ? "Full" : "Read-only"}
                                </Badge>
                            </Table.Td>
                            <Table.Td>
                                <Badge color={user.isActive ? "green" : "red"}>
                                    {user.isActive ? "Active" : "Inactive"}
                                </Badge>
                            </Table.Td>
                            <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                    <ActionIcon
                                        variant="subtle"
                                        onClick={() => presenter.openEditModal(user.id)}
                                        aria-label="Edit user"
                                    >
                                        ✎
                                    </ActionIcon>
                                    {vm.canManage && !user.isSelf && (
                                        <>
                                            <ActionIcon
                                                variant="subtle"
                                                onClick={() =>
                                                    void presenter.forceLogoutUser(user.id)
                                                }
                                                aria-label="Force logout user"
                                            >
                                                ⇥
                                            </ActionIcon>
                                            <ActionIcon
                                                variant="subtle"
                                                color="red"
                                                onClick={() => presenter.confirmDelete(user.id)}
                                                aria-label="Delete user"
                                            >
                                                ✕
                                            </ActionIcon>
                                        </>
                                    )}
                                </Group>
                            </Table.Td>
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>

            {vm.totalPages > 1 && (
                <Pagination
                    total={vm.totalPages}
                    value={vm.page}
                    onChange={page => presenter.setPage(page)}
                />
            )}

            <Modal
                opened={vm.createModal !== null}
                onClose={() => presenter.closeModal()}
                title="Add User"
            >
                <Stack>
                    <TextInput
                        label="Email"
                        value={vm.createModal?.email ?? ""}
                        onChange={event => presenter.setCreateEmail(event.currentTarget.value)}
                    />
                    <TextInput
                        label="Display Name"
                        value={vm.createModal?.displayName ?? ""}
                        onChange={event =>
                            presenter.setCreateDisplayName(event.currentTarget.value)
                        }
                    />
                    <PasswordInput
                        label="Password"
                        value={vm.createModal?.password ?? ""}
                        onChange={event => presenter.setCreatePassword(event.currentTarget.value)}
                    />
                    <Select
                        label="Permission"
                        data={PERMISSION_SELECT_DATA}
                        value={vm.createModal?.permission ?? "read-only"}
                        onChange={value =>
                            presenter.setCreatePermission((value as UserPermission) ?? "read-only")
                        }
                    />
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={() => presenter.closeModal()}>
                            Cancel
                        </Button>
                        <Button loading={vm.savingUser} onClick={() => void presenter.saveCreate()}>
                            Create
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <Modal
                opened={vm.editModal !== null}
                onClose={() => presenter.closeModal()}
                title="Edit User"
            >
                <Stack>
                    <TextInput
                        label="Display Name"
                        value={vm.editModal?.displayName ?? ""}
                        onChange={event => presenter.setEditDisplayName(event.currentTarget.value)}
                    />
                    {vm.canManage && (
                        <Select
                            label="Permission"
                            data={PERMISSION_SELECT_DATA}
                            value={vm.editModal?.permission ?? "read-only"}
                            onChange={value =>
                                presenter.setEditPermission(
                                    (value as UserPermission) ?? "read-only"
                                )
                            }
                        />
                    )}
                    <Group justify="flex-end">
                        <Button variant="subtle" onClick={() => presenter.closeModal()}>
                            Cancel
                        </Button>
                        <Button loading={vm.savingUser} onClick={() => void presenter.saveEdit()}>
                            Save
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <ConfirmDialog
                opened={vm.deletingUserId !== null}
                title="Delete User"
                message="Deactivate this user? They will be logged out and unable to sign in again."
                confirmLabel="Delete"
                onConfirm={() => void presenter.deleteUser()}
                onCancel={() => presenter.cancelDelete()}
            />
        </Stack>
    );
});
