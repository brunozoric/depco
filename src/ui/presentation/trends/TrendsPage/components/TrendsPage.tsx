import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Skeleton, Stack, Text, Title } from "@mantine/core";
import type { TrendsPresenter } from "../abstractions/TrendsPresenter.js";
import { StalenessTrendChart } from "./StalenessTrendChart.js";
import { LicenseComplianceTrendChart } from "./LicenseComplianceTrendChart.js";
import { AutoFixTrendChart } from "./AutoFixTrendChart.js";
import { PackageCountTrendChart } from "./PackageCountTrendChart.js";
import { DependencyChangesTable } from "./DependencyChangesTable.js";

interface TrendsPageProps {
    presenter: TrendsPresenter.Interface;
}

export const TrendsPage = observer(function TrendsPage({
    presenter
}: TrendsPageProps): React.ReactNode {
    useEffect(() => {
        void presenter.load();
        return () => presenter.dispose();
    }, [presenter]);

    const { vm } = presenter;

    if (vm.loading && vm.stalenessPoints.length === 0) {
        return (
            <Stack>
                <Title order={2}>Trends</Title>
                <Skeleton height={300} />
                <Skeleton height={300} />
                <Skeleton height={300} />
            </Stack>
        );
    }

    return (
        <Stack>
            <Title order={2}>Trends</Title>

            {vm.error && <Text c="red">{vm.error}</Text>}

            <StalenessTrendChart
                data={vm.stalenessPoints}
                range={vm.stalenessRange}
                onRangeChange={range => presenter.setStalenessRange(range)}
            />

            <LicenseComplianceTrendChart
                data={vm.licensePoints}
                range={vm.licenseRange}
                onRangeChange={range => presenter.setLicenseRange(range)}
            />

            <AutoFixTrendChart
                data={vm.autoFixPoints}
                range={vm.autoFixRange}
                onRangeChange={range => presenter.setAutoFixRange(range)}
            />

            <PackageCountTrendChart data={vm.packageCountPoints} range={vm.stalenessRange} />

            <DependencyChangesTable
                items={vm.dependencyChanges}
                total={vm.dependencyChangesTotal}
                availableProjects={vm.availableProjects}
                projectFilter={vm.dependencyChangesProjectFilter}
                onProjectFilterChange={projectId =>
                    presenter.setDependencyChangesProjectFilter(projectId)
                }
            />
        </Stack>
    );
});
