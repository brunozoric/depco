import type React from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PmSettingsPresenter } from "../abstractions/PmSettingsPresenter.js";

interface PmSettingsConfirmDialogProps {
    presenter: PmSettingsPresenter.Interface;
}

export const PmSettingsConfirmDialog = observer(function PmSettingsConfirmDialog({
    presenter
}: PmSettingsConfirmDialogProps): React.ReactNode {
    const { vm } = presenter;

    return (
        <Modal
            opened={vm.confirmDialog !== null}
            onClose={() => presenter.cancelSave()}
            title="Confirm changes"
            centered
        >
            <Stack gap="md">
                <Text size="sm">{vm.confirmDialog?.description}</Text>
                <Text size="xs" c="dimmed">
                    This will modify{" "}
                    <Text component="code" ff="monospace" size="xs">
                        .dependency-upgrader.json
                    </Text>
                </Text>
                <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 200 }}>
                    {JSON.stringify(vm.confirmDialog?.changes, null, 2)}
                </pre>
                <Group justify="flex-end">
                    <Button variant="default" onClick={() => presenter.cancelSave()}>
                        Cancel
                    </Button>
                    <Button onClick={() => presenter.confirmSave()} loading={vm.saving}>
                        Confirm
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
});
