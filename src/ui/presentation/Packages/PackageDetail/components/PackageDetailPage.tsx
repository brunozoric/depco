import type React from "react";
import { useEffect } from "react";
import { Alert, Center, Divider, Loader, Stack, Text } from "@mantine/core";
import { observer } from "mobx-react-lite";
import type { PackageDetailPresenter } from "../abstractions/PackageDetailPresenter.js";
import { PackageDetailHeader } from "./PackageDetailHeader.js";
import { PackageDetailProjectsTable } from "./PackageDetailProjectsTable.js";
import { PackageDetailChangelogSection } from "./PackageDetailChangelogSection.js";
import { PackageDetailVulnerabilitiesSection } from "./PackageDetailVulnerabilitiesSection.js";
import { PackageDetailLicenseSection } from "./PackageDetailLicenseSection.js";

interface PackageDetailPageProps {
    presenter: PackageDetailPresenter.Interface;
    packageName: string;
}

export const PackageDetailPage = observer(function PackageDetailPage({
    presenter,
    packageName
}: PackageDetailPageProps): React.ReactNode {
    const { vm } = presenter;

    useEffect(() => {
        void presenter.load(packageName);
        return () => presenter.dispose();
    }, [presenter, packageName]);

    if (vm.loading && !vm.packageDetail) {
        return (
            <Center py="xl">
                <Loader />
            </Center>
        );
    }

    if (vm.error) {
        return (
            <Alert color="red" title="Error">
                {vm.error}
            </Alert>
        );
    }

    if (!vm.packageDetail) {
        return <Text c="dimmed">Package not found</Text>;
    }

    return (
        <Stack gap="lg" data-testid="package-detail-page">
            <PackageDetailHeader packageDetail={vm.packageDetail} />

            <Divider />

            <PackageDetailProjectsTable projects={vm.packageDetail.projects} />

            <Divider />

            <PackageDetailChangelogSection
                changelogs={vm.changelogs}
                resolving={vm.changelogsResolving}
                onReResolve={() => void presenter.reResolveChangelogs()}
            />

            <Divider />

            <PackageDetailVulnerabilitiesSection vulnerabilities={vm.vulnerabilities} />

            <Divider />

            <PackageDetailLicenseSection licenses={vm.licenses} />
        </Stack>
    );
});
