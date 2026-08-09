import { createFeature } from "#shared/index.js";

import { LoginPageFeature } from "./Auth/LoginPage/feature.js";
import { AutoFixUseCasesFeature } from "./AutoFix/useCases/feature.js";
import { BackupPresentationFeature } from "./Backup/BackupPage/feature.js";
import { BackupUseCasesFeature } from "./Backup/useCases/feature.js";
import { DashboardPresentationFeature } from "./Dashboard/Dashboard/feature.js";
import { DashboardUseCasesFeature } from "./Dashboard/useCases/feature.js";
import { DependencyGraphPageFeature } from "./DependencyGraph/GraphPage/feature.js";
import { DependencyGraphUseCasesFeature } from "./DependencyGraph/useCases/feature.js";
import { JobManagerPresentationFeature } from "./Jobs/JobManager/feature.js";
import { JobManagerUseCasesFeature } from "./Jobs/JobManager/useCases/feature.js";
import { JobProgressFeature } from "./Jobs/JobProgress/feature.js";
import { LicenseListFeature } from "./Licenses/LicensesList/feature.js";
import { LicensesUseCasesFeature } from "./Licenses/useCases/feature.js";
import { LogBrowserPresentationFeature } from "./Logs/LogBrowser/feature.js";
import { AppLogsUseCasesFeature } from "./Logs/useCases/feature.js";
import { PackageListFeature } from "./Packages/PackageList/feature.js";
import { PackagesUseCasesFeature } from "./Packages/useCases/feature.js";
import { ProjectDetailFeature } from "./Projects/ProjectDetail/feature.js";
import { ProjectListFeature } from "./Projects/ProjectList/feature.js";
import { StepHooksPresentationFeature } from "./Projects/StepHooks/feature.js";
import { UpgradeWizardFeature } from "./Projects/UpgradeWizard/feature.js";
import { ProjectsUseCasesFeature } from "./Projects/useCases/feature.js";
import { SbomPageFeature } from "./Sbom/SbomPage/feature.js";
import { SbomUseCasesFeature } from "./Sbom/useCases/feature.js";
import { ScanSchedulesUseCasesFeature } from "./ScanSchedules/useCases/feature.js";
import { AppSettingsPresentationFeature } from "./Settings/AppSettings/feature.js";
import { PmSettingsPresentationFeature } from "./Settings/PmSettings/feature.js";
import { AppSettingsUseCasesFeature } from "./Settings/appSettingsUseCases/feature.js";
import { SecuritySettingsUseCasesFeature } from "./Settings/useCases/feature.js";
import { TeamDetailFeature } from "./Teams/TeamDetail/feature.js";
import { TeamsPageFeature } from "./Teams/TeamsPage/feature.js";
import { TeamsUseCasesFeature } from "./Teams/useCases/feature.js";
import { TrendsPageFeature } from "./Trends/TrendsPage/feature.js";
import { TrendsUseCasesFeature } from "./Trends/useCases/feature.js";
import { UpgradesUseCasesFeature } from "./Upgrades/useCases/feature.js";
import { UserListFeature } from "./Users/UserList/feature.js";
import { UsersUseCasesFeature } from "./Users/useCases/feature.js";
import { VulnerabilityDetailFeature } from "./Vulnerabilities/VulnerabilityDetail/feature.js";
import { VulnerabilityListFeature } from "./Vulnerabilities/VulnerabilityList/feature.js";
import { VulnerabilitiesUseCasesFeature } from "./Vulnerabilities/useCases/feature.js";

export const PresentationFeature = createFeature({
    name: "Ui/Presentation",
    dependencies: [
        LoginPageFeature,
        AutoFixUseCasesFeature,
        BackupUseCasesFeature,
        BackupPresentationFeature,
        DashboardUseCasesFeature,
        DashboardPresentationFeature,
        DependencyGraphUseCasesFeature,
        DependencyGraphPageFeature,
        JobManagerUseCasesFeature,
        JobManagerPresentationFeature,
        JobProgressFeature,
        LicensesUseCasesFeature,
        LicenseListFeature,
        AppLogsUseCasesFeature,
        LogBrowserPresentationFeature,
        PackagesUseCasesFeature,
        PackageListFeature,
        ProjectsUseCasesFeature,
        ProjectListFeature,
        ProjectDetailFeature,
        StepHooksPresentationFeature,
        UpgradeWizardFeature,
        SbomUseCasesFeature,
        SbomPageFeature,
        ScanSchedulesUseCasesFeature,
        SecuritySettingsUseCasesFeature,
        PmSettingsPresentationFeature,
        AppSettingsUseCasesFeature,
        AppSettingsPresentationFeature,
        TeamsUseCasesFeature,
        TeamsPageFeature,
        TeamDetailFeature,
        TrendsUseCasesFeature,
        TrendsPageFeature,
        UpgradesUseCasesFeature,
        UsersUseCasesFeature,
        UserListFeature,
        VulnerabilitiesUseCasesFeature,
        VulnerabilityListFeature,
        VulnerabilityDetailFeature
    ],
    register() {}
});
