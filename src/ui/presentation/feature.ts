import { createFeature } from "#shared/index.js";

import { AuthPresentationFeature } from "./Auth/feature.js";
import { AutoFixPresentationFeature } from "./AutoFix/feature.js";
import { BackupDomainFeature } from "./Backup/feature.js";
import { DashboardDomainFeature } from "./Dashboard/feature.js";
import { DependencyGraphDomainFeature } from "./DependencyGraph/feature.js";
import { JobsDomainFeature } from "./Jobs/feature.js";
import { LicensesDomainFeature } from "./Licenses/feature.js";
import { LogsDomainFeature } from "./Logs/feature.js";
import { PackagesDomainFeature } from "./Packages/feature.js";
import { ProjectsDomainFeature } from "./Projects/feature.js";
import { SbomDomainFeature } from "./Sbom/feature.js";
import { ScanSchedulesDomainFeature } from "./ScanSchedules/feature.js";
import { SettingsDomainFeature } from "./Settings/feature.js";
import { TeamsDomainFeature } from "./Teams/feature.js";
import { TrendsDomainFeature } from "./Trends/feature.js";
import { UpgradesDomainFeature } from "./Upgrades/feature.js";
import { UsersDomainFeature } from "./Users/feature.js";
import { VulnerabilitiesDomainFeature } from "./Vulnerabilities/feature.js";

export const PresentationFeature = createFeature({
    name: "Ui/Presentation",
    dependencies: [
        AuthPresentationFeature,
        AutoFixPresentationFeature,
        BackupDomainFeature,
        DependencyGraphDomainFeature,
        JobsDomainFeature,
        LicensesDomainFeature,
        LogsDomainFeature,
        PackagesDomainFeature,
        ProjectsDomainFeature,
        SbomDomainFeature,
        ScanSchedulesDomainFeature,
        SettingsDomainFeature,
        TeamsDomainFeature,
        TrendsDomainFeature,
        UpgradesDomainFeature,
        UsersDomainFeature,
        VulnerabilitiesDomainFeature,
        DashboardDomainFeature
    ],
    register() {}
});
