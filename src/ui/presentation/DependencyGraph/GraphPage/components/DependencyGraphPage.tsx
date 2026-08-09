import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    ActionIcon,
    Card,
    Center,
    CloseButton,
    Group,
    Loader,
    NumberInput,
    Paper,
    ScrollArea,
    SegmentedControl,
    Select,
    SimpleGrid,
    Stack,
    Text,
    TextInput,
    Title,
    UnstyledButton
} from "@mantine/core";
import type { DependencyGraphPresenter } from "../abstractions/DependencyGraphPresenter.js";
import { DependencyTreeView } from "./DependencyTreeView.js";
import { DependencyGraphView } from "./DependencyGraphView.js";

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
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    useEffect(() => {
        void presenter.load(projectId);
    }, [presenter, projectId]);

    useEffect(() => {
        return () => presenter.dispose();
    }, [presenter]);

    const searchWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setHighlightedIndex(-1);
    }, [vm.searchSuggestions]);

    useEffect(() => {
        if (!vm.showSuggestions) {
            return;
        }

        function handleClickOutside(event: MouseEvent): void {
            if (
                searchWrapperRef.current &&
                !searchWrapperRef.current.contains(event.target as Node)
            ) {
                presenter.closeSuggestions();
            }
        }

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [vm.showSuggestions, presenter]);

    const handleSearchKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (!vm.showSuggestions || vm.searchSuggestions.length === 0) {
                if (event.key === "Enter") {
                    void presenter.search(vm.searchQuery);
                }
                return;
            }

            if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlightedIndex(current =>
                    current < vm.searchSuggestions.length - 1 ? current + 1 : 0
                );
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlightedIndex(current =>
                    current > 0 ? current - 1 : vm.searchSuggestions.length - 1
                );
            } else if (event.key === "Enter") {
                event.preventDefault();
                if (highlightedIndex >= 0 && highlightedIndex < vm.searchSuggestions.length) {
                    presenter.selectSuggestion(vm.searchSuggestions[highlightedIndex]!);
                } else {
                    void presenter.search(vm.searchQuery);
                }
            } else if (event.key === "Escape") {
                presenter.closeSuggestions();
            }
        },
        [presenter, vm.showSuggestions, vm.searchSuggestions, vm.searchQuery, highlightedIndex]
    );

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
                    <div ref={searchWrapperRef} style={{ position: "relative" }}>
                        <TextInput
                            placeholder="Search package"
                            value={vm.searchQuery}
                            onChange={event => presenter.setSearchQuery(event.currentTarget.value)}
                            onKeyDown={handleSearchKeyDown}
                            w={300}
                            rightSection={
                                vm.searchQuery ? (
                                    <CloseButton
                                        size="sm"
                                        onClick={() => presenter.clearSearch()}
                                    />
                                ) : undefined
                            }
                        />
                        {vm.showSuggestions && vm.searchSuggestions.length > 0 && (
                            <Paper
                                shadow="md"
                                withBorder
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    zIndex: 100
                                }}
                            >
                                <ScrollArea.Autosize mah={200}>
                                    {vm.searchSuggestions.map((name, index) => (
                                        <UnstyledButton
                                            key={name}
                                            display="block"
                                            w="100%"
                                            p="xs"
                                            onClick={() => presenter.selectSuggestion(name)}
                                            style={{
                                                backgroundColor:
                                                    index === highlightedIndex
                                                        ? "var(--mantine-color-blue-light)"
                                                        : undefined
                                            }}
                                        >
                                            <Text size="sm">{name}</Text>
                                        </UnstyledButton>
                                    ))}
                                </ScrollArea.Autosize>
                            </Paper>
                        )}
                    </div>
                    {vm.paths.length > 0 && (
                        <SegmentedControl
                            value={vm.searchMode}
                            onChange={value =>
                                presenter.setSearchMode(
                                    value as DependencyGraphPresenter.SearchMode
                                )
                            }
                            data={[
                                { label: "Dim", value: "dim" },
                                { label: "Matches only", value: "matchesOnly" }
                            ]}
                        />
                    )}
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
