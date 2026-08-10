import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import {
    ActionIcon,
    Card,
    Center,
    Group,
    Loader,
    NumberInput,
    SegmentedControl,
    Select,
    SimpleGrid,
    Stack,
    Text,
    Title
} from "@mantine/core";
import type { DependencyGraphPresenter } from "../abstractions/DependencyGraphPresenter.js";
import { DependencyTreeView } from "./DependencyTreeView.js";
import { DependencyGraphView } from "./DependencyGraphView.js";
import { GraphSearchBar } from "./GraphSearchBar.js";

const DEPENDENCY_KIND_OPTIONS = [
    { label: "All", value: "" },
    { label: "Direct", value: "dependency" },
    { label: "Dev", value: "devDependency" },
    { label: "Peer", value: "peerDependency" },
    { label: "Optional", value: "optionalDependency" },
    { label: "Transitive", value: "transitive" }
];

interface DependencyGraphPageProps {
    presenter: DependencyGraphPresenter.Interface;
    projectId: string;
}

export const DependencyGraphPage = observer(function DependencyGraphPage({
    presenter,
    projectId
}: DependencyGraphPageProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        void presenter.load(projectId);
    }, [presenter, projectId]);

    useEffect(() => {
        return () => presenter.dispose();
    }, [presenter]);

    if (vm.loading && !vm.stats) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    if (vm.error) {
        return (
            <Stack>
                <Title order={2}>Dependency Graph</Title>
                <Text c="red">{vm.error}</Text>
            </Stack>
        );
    }

    return (
        <Stack gap="md">
            <Group justify="space-between">
                <Title order={2}>Dependency Graph</Title>
                <ActionIcon
                    variant="subtle"
                    size="lg"
                    onClick={() => void presenter.refresh()}
                    loading={vm.loading}
                >
                    &#x21bb;
                </ActionIcon>
            </Group>

            {vm.stats && (
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                            Total Packages
                        </Text>
                        <Text size="xl" fw={700}>
                            {vm.stats.totalPackages}
                        </Text>
                    </Card>
                    <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                            Max Depth
                        </Text>
                        <Text size="xl" fw={700}>
                            {vm.stats.maxDepth}
                        </Text>
                    </Card>
                    <Card withBorder padding="md">
                        <Text size="sm" c="dimmed">
                            Edges
                        </Text>
                        <Text size="xl" fw={700}>
                            {vm.stats.edgeCount}
                        </Text>
                    </Card>
                </SimpleGrid>
            )}

            <Group justify="space-between">
                <SegmentedControl
                    value={vm.viewMode}
                    onChange={value =>
                        presenter.setViewMode(value as DependencyGraphPresenter.ViewMode)
                    }
                    data={[
                        { label: "Tree", value: "tree" },
                        { label: "Graph", value: "graph" }
                    ]}
                />
                <Group>
                    <GraphSearchBar presenter={presenter} />
                </Group>
            </Group>

            <Group gap="sm">
                <Select
                    placeholder="Dependency kind"
                    data={DEPENDENCY_KIND_OPTIONS}
                    value={vm.filters.dependencyKind ?? ""}
                    onChange={value =>
                        presenter.setFilter({
                            field: "dependencyKind",
                            value: value === "" ? null : value
                        })
                    }
                    w={180}
                    clearable={false}
                />
                <NumberInput
                    placeholder="Max depth"
                    value={vm.filters.maxDepth ?? ""}
                    onChange={value =>
                        presenter.setFilter({
                            field: "maxDepth",
                            value: value === "" ? null : Number(value)
                        })
                    }
                    min={0}
                    w={140}
                />
            </Group>

            {vm.viewMode === "tree" ? (
                <DependencyTreeView presenter={presenter} />
            ) : (
                <DependencyGraphView presenter={presenter} />
            )}
        </Stack>
    );
});
