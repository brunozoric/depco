import type React from "react";
import { Fragment } from "react";
import { observer } from "mobx-react-lite";
import { Code, List, Stack, Text } from "@mantine/core";
import type { DependencyGraphPresenter } from "../abstractions/DependencyGraphPresenter.js";

interface DependencyTreeViewProps {
    presenter: DependencyGraphPresenter.Interface;
}

const PROJECT_ROOT_LABEL = "project";

export const DependencyTreeView = observer(function DependencyTreeView({
    presenter
}: DependencyTreeViewProps): React.ReactNode {
    const { vm } = presenter;

    if (vm.searchQuery.trim() === "") {
        return (
            <Stack align="center" py="xl">
                <Text c="dimmed">Search for a package to see its dependency paths.</Text>
            </Stack>
        );
    }

    if (vm.paths.length === 0) {
        return (
            <Stack align="center" py="xl">
                <Text c="dimmed">No paths found for &ldquo;{vm.searchQuery}&rdquo;.</Text>
            </Stack>
        );
    }

    return (
        <List spacing="sm">
            {vm.paths.map((path, pathIndex) => (
                <List.Item key={`${path.target}-${pathIndex}`}>
                    <Text size="sm">
                        <Code>{PROJECT_ROOT_LABEL}</Code>
                        {path.chain.map((node, nodeIndex) => (
                            <Fragment key={`${node.packageName}@${node.version}-${nodeIndex}`}>
                                {" → "}
                                <Code>
                                    {node.packageName}@{node.version}
                                </Code>
                            </Fragment>
                        ))}
                    </Text>
                </List.Item>
            ))}
        </List>
    );
});
