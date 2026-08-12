import type React from "react";
import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Stack, Skeleton, Text, Title, SimpleGrid } from "@mantine/core";
import { navigate } from "#ui/infrastructure/Router/router.js";
import type { DashboardPresenter } from "../abstractions/DashboardPresenter.js";
import { SummaryCards } from "./SummaryCards.js";
import { ProjectHealthTable } from "./ProjectHealthTable.js";
import { ScoreDetailModal } from "./ScoreDetailModal.js";
import { HealthTrendChart } from "./HealthTrendChart.js";
import { VulnerabilityTrendChart } from "./VulnerabilityTrendChart.js";
import { RecentActivityWidget } from "./RecentActivityWidget.js";
import { ScanFreshnessWidget } from "./ScanFreshnessWidget.js";
import { SecurityOverviewWidget } from "./SecurityOverviewWidget.js";
import { VulnerabilitySummaryWidget } from "./VulnerabilitySummaryWidget.js";
import { LicenseComplianceWidget } from "./LicenseComplianceWidget.js";
import { StalenessSummaryCard } from "./StalenessSummaryCard.js";
import { LicenseComplianceSummaryCard } from "./LicenseComplianceSummaryCard.js";
import { AutoFixSummaryCard } from "./AutoFixSummaryCard.js";
import { EngineOverviewWidget } from "./EngineOverviewWidget.js";

interface DashboardPageProps {
    presenter: DashboardPresenter.Interface;
}

export const DashboardPage = observer(function DashboardPage({
    presenter
}: DashboardPageProps): React.ReactNode {
    useEffect(() => {
        void presenter.load();
        return () => presenter.dispose();
    }, [presenter]);

    const { vm } = presenter;

    if (vm.loading) {
        return (
            <Stack>
                <Skeleton height={100} />
                <Skeleton height={200} />
                <Skeleton height={300} />
            </Stack>
        );
    }

    if (vm.error) {
        return <Text c="red">{vm.error}</Text>;
    }

    return (
        <Stack>
            <Title order={2}>Dashboard</Title>

            <SummaryCards summary={vm.summary} openAutoFixPrCount={vm.openAutoFixPrCount} />

            <SimpleGrid cols={3}>
                <StalenessSummaryCard data={vm.stalenessTrend} />
                <LicenseComplianceSummaryCard data={vm.licenseTrend} />
                <AutoFixSummaryCard data={vm.autoFixTrend} />
            </SimpleGrid>

            <ProjectHealthTable
                projects={vm.projects}
                onScoreClick={projectId => presenter.openScoreModal(projectId)}
            />

            <HealthTrendChart
                trendData={vm.trendData}
                trendRange={vm.trendRange}
                onRangeChange={range => presenter.setTrendRange(range)}
            />

            <VulnerabilityTrendChart
                data={vm.vulnerabilityTrend}
                range={vm.vulnerabilityTrendRange}
                onRangeChange={range => presenter.setVulnerabilityTrendRange(range)}
                onDateClick={date => navigate(`/vulnerabilities?scannedDate=${date}`)}
            />

            <SimpleGrid cols={2}>
                <RecentActivityWidget jobs={vm.activity} />
                <ScanFreshnessWidget projects={vm.staleness} />
                <SecurityOverviewWidget projects={vm.security} />
                <VulnerabilitySummaryWidget summary={vm.vulnerabilitySummary} />
                <LicenseComplianceWidget summary={vm.licenseCompliance} />
                <EngineOverviewWidget summary={vm.engineSummary} />
            </SimpleGrid>

            {vm.scoreModalProjectId && (
                <ScoreDetailModal
                    project={vm.projects.find(p => p.projectId === vm.scoreModalProjectId)}
                    detail={vm.scoreDetail}
                    loading={vm.scoreDetailLoading}
                    onClose={() => presenter.closeScoreModal()}
                />
            )}
        </Stack>
    );
});
