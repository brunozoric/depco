import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import {
    CloseButton,
    Paper,
    ScrollArea,
    SegmentedControl,
    Text,
    TextInput,
    UnstyledButton
} from "@mantine/core";
import type { DependencyGraphPresenter } from "../abstractions/DependencyGraphPresenter.js";

interface GraphSearchBarProps {
    presenter: DependencyGraphPresenter.Interface;
}

export const GraphSearchBar = observer(function GraphSearchBar({
    presenter
}: GraphSearchBarProps): React.ReactNode {
    const { vm } = presenter;
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
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

    return (
        <>
            <div ref={searchWrapperRef} style={{ position: "relative" }}>
                <TextInput
                    placeholder="Search package"
                    value={vm.searchQuery}
                    onChange={event => presenter.setSearchQuery(event.currentTarget.value)}
                    onKeyDown={handleSearchKeyDown}
                    w={300}
                    rightSection={
                        vm.searchQuery ? (
                            <CloseButton size="sm" onClick={() => presenter.clearSearch()} />
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
                        presenter.setSearchMode(value as DependencyGraphPresenter.SearchMode)
                    }
                    data={[
                        { label: "Dim", value: "dim" },
                        { label: "Matches only", value: "matchesOnly" }
                    ]}
                />
            )}
        </>
    );
});
