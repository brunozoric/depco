import {
    sqliteTable,
    text,
    integer,
    uniqueIndex,
    primaryKey,
    unique,
    index
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    path: text("path").notNull().unique(),
    packageManager: text("package_manager"),
    pmVersion: text("pm_version"),
    addedAt: integer("added_at").notNull(),
    lastScannedAt: integer("last_scanned_at"),
    engineStatus: text("engine_status"),
    rootEnginesNode: text("root_engines_node")
});

export const upgradeJobs = sqliteTable(
    "upgrade_jobs",
    {
        id: text("id").primaryKey().notNull(),
        referenceId: text("reference_id").notNull(),
        referenceType: text("reference_type").notNull().default("project"),
        type: text("type").notNull(),
        status: text("status").notNull(),
        packages: text("packages"),
        logs: text("logs"),
        startedAt: integer("started_at"),
        completedAt: integer("completed_at"),
        warning: text("warning"),
        progress: integer("progress"),
        progressLabel: text("progress_label"),
        parentJobId: text("parent_job_id")
    },
    table => ({
        referenceIdx: index("upgrade_jobs_reference_id_idx").on(table.referenceId),
        statusIdx: index("upgrade_jobs_status_idx").on(table.status),
        parentJobIdx: index("upgrade_jobs_parent_job_id_idx").on(table.parentJobId)
    })
);

export const registryCache = sqliteTable("registry_cache", {
    packageName: text("package_name").primaryKey().notNull(),
    data: text("data").notNull(),
    cachedAt: integer("cached_at").notNull()
});

export const securityChecks = sqliteTable(
    "security_checks",
    {
        id: text("id").primaryKey().notNull(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id),
        checkedAt: integer("checked_at").notNull(),
        results: text("results").notNull(),
        passes: integer("passes").notNull().default(0)
    },
    table => ({
        projectIdIdx: index("security_checks_project_id_idx").on(table.projectId)
    })
);

export const scanResults = sqliteTable(
    "scan_results",
    {
        id: text("id").primaryKey().notNull(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id),
        name: text("name").notNull(),
        currentVersion: text("current_version").notNull(),
        latestVersion: text("latest_version"),
        latestInRange: text("latest_in_range"),
        type: text("type").notNull(),
        upgradeType: text("upgrade_type"),
        dependencyKind: text("dependency_kind").notNull().default("dependency"),
        registryResolved: integer("registry_resolved").notNull().default(1),
        scannedAt: integer("scanned_at").notNull()
    },
    table => ({
        projectIdIdx: index("scan_results_project_id_idx").on(table.projectId)
    })
);

export const pmSecuritySettings = sqliteTable(
    "pm_security_settings",
    {
        id: text("id").primaryKey().notNull(),
        packageManager: text("package_manager").notNull(),
        configFile: text("config_file").notNull(),
        fieldName: text("field_name").notNull(),
        expectedValue: text("expected_value").notNull(),
        enabled: integer("enabled").notNull().default(1)
    },
    table => ({
        packageManagerConfigFieldUnique: uniqueIndex(
            "pm_security_settings_pm_config_field_unique"
        ).on(table.packageManager, table.configFile, table.fieldName)
    })
);

export const dependencies = sqliteTable("dependencies", {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull().unique(),
    repoUrl: text("repo_url"),
    repoDirectory: text("repo_directory"),
    createdAt: integer("created_at").notNull()
});

export const dependencyVersions = sqliteTable(
    "dependency_versions",
    {
        id: text("id").primaryKey().notNull(),
        dependencyId: text("dependency_id")
            .notNull()
            .references(() => dependencies.id),
        version: text("version").notNull(),
        publishedAt: integer("published_at")
    },
    table => ({
        depVersionUnique: uniqueIndex("dep_versions_dep_version_unique").on(
            table.dependencyId,
            table.version
        )
    })
);

export const changelogs = sqliteTable("changelogs", {
    id: text("id").primaryKey().notNull(),
    dependencyId: text("dependency_id")
        .notNull()
        .references(() => dependencies.id),
    dependencyVersionId: text("dependency_version_id")
        .notNull()
        .unique()
        .references(() => dependencyVersions.id),
    content: text("content"),
    source: text("source"),
    fetchedAt: integer("fetched_at")
});

export const appSettings = sqliteTable("app_settings", {
    key: text("key").primaryKey().notNull(),
    value: text("value").notNull()
});

export const appLogs = sqliteTable(
    "app_logs",
    {
        id: text("id").primaryKey().notNull(),
        level: text("level").notNull(),
        source: text("source").notNull(),
        projectId: text("project_id"),
        message: text("message").notNull(),
        details: text("details"),
        createdAt: integer("created_at").notNull()
    },
    table => ({
        projectIdIdx: index("app_logs_project_id_idx").on(table.projectId)
    })
);

export const upgradeSessions = sqliteTable(
    "upgrade_sessions",
    {
        id: text("id").primaryKey().notNull(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id),
        status: text("status").notNull(),
        currentStep: text("current_step").notNull(),
        steps: text("steps").notNull(),
        stepOrder: text("step_order"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    table => ({
        projectIdIdx: index("upgrade_sessions_project_id_idx").on(table.projectId)
    })
);

export const projectStepHooks = sqliteTable(
    "project_step_hooks",
    {
        id: text("id").primaryKey().notNull(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id),
        position: text("position").notNull(),
        name: text("name").notNull(),
        command: text("command").notNull(),
        type: text("type").notNull(),
        required: integer("required").notNull().default(0),
        enabled: integer("enabled").notNull().default(1),
        sortOrder: integer("sort_order").notNull().default(0),
        source: text("source").notNull().default("db"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    table => ({
        projectIdIdx: index("project_step_hooks_project_id_idx").on(table.projectId)
    })
);

export const healthSnapshots = sqliteTable(
    "health_snapshots",
    {
        id: text("id").primaryKey().notNull(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id),
        date: text("date").notNull(),
        score: integer("score").notNull(),
        totalPackages: integer("total_packages").notNull(),
        upToDate: integer("up_to_date").notNull(),
        patchOutdated: integer("patch_outdated").notNull(),
        minorOutdated: integer("minor_outdated").notNull(),
        majorOutdated: integer("major_outdated").notNull(),
        scannedAt: integer("scanned_at").notNull(),
        vulnerabilityCritical: integer("vuln_critical").notNull().default(0),
        vulnerabilityHigh: integer("vuln_high").notNull().default(0),
        vulnerabilityModerate: integer("vuln_moderate").notNull().default(0),
        vulnerabilityLow: integer("vuln_low").notNull().default(0)
    },
    table => ({
        projectDateUnique: uniqueIndex("health_snapshots_project_date_unique").on(
            table.projectId,
            table.date
        )
    })
);

export const scanSchedules = sqliteTable("scan_schedules", {
    id: text("id").primaryKey().notNull(),
    projectId: text("project_id")
        .notNull()
        .unique()
        .references(() => projects.id),
    interval: text("interval").notNull(),
    lastRunAt: integer("last_run_at"),
    nextRunAt: integer("next_run_at"),
    enabled: integer("enabled").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
});

export const vulnerabilities = sqliteTable(
    "vulnerabilities",
    {
        id: text("id").primaryKey().notNull(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        packageName: text("package_name").notNull(),
        severity: text("severity").notNull(),
        title: text("title").notNull(),
        advisoryUrl: text("advisory_url"),
        cveId: text("cve_id"),
        dedupKey: text("dedup_key").notNull(),
        vulnerableRange: text("vulnerable_range"),
        fixVersion: text("fix_version"),
        source: text("source").notNull(),
        dependencyKind: text("dependency_kind").notNull().default("dependency"),
        installedVersion: text("installed_version"),
        scannedAt: integer("scanned_at").notNull(),
        dismissedAt: integer("dismissed_at"),
        dismissedUntil: integer("dismissed_until"),
        dismissedBy: text("dismissed_by")
    },
    table => ({
        projectPackageDedupUnique: uniqueIndex("vuln_project_package_dedup_unique").on(
            table.projectId,
            table.packageName,
            table.dedupKey
        )
    })
);

export const osvCache = sqliteTable(
    "osv_cache",
    {
        packageName: text("package_name").notNull(),
        version: text("version").notNull(),
        data: text("data").notNull(),
        cachedAt: integer("cached_at").notNull()
    },
    table => ({
        pk: primaryKey({ columns: [table.packageName, table.version] })
    })
);

export const licenses = sqliteTable(
    "licenses",
    {
        id: text("id").primaryKey(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        packageName: text("package_name").notNull(),
        licenseName: text("license_name").notNull(),
        spdxId: text("spdx_id"),
        source: text("source").notNull(),
        riskTier: text("risk_tier").notNull(),
        licenseUrl: text("license_url"),
        scannedAt: integer("scanned_at").notNull()
    },
    table => ({
        uniqueProjectPackage: unique().on(table.projectId, table.packageName)
    })
);

export const licensePolicyRules = sqliteTable(
    "license_policy_rules",
    {
        id: text("id").primaryKey(),
        action: text("action").notNull(),
        licensePattern: text("license_pattern"),
        packagePattern: text("package_pattern"),
        projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
        priority: integer("priority").notNull(),
        reason: text("reason"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    table => ({
        projectIdIdx: index("license_policy_rules_project_id_idx").on(table.projectId)
    })
);

export const licenseViolations = sqliteTable(
    "license_violations",
    {
        id: text("id").primaryKey(),
        licenseId: text("license_id")
            .notNull()
            .references(() => licenses.id, { onDelete: "cascade" }),
        ruleId: text("rule_id")
            .notNull()
            .references(() => licensePolicyRules.id, { onDelete: "cascade" }),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        packageName: text("package_name").notNull(),
        action: text("action").notNull(),
        scannedAt: integer("scanned_at").notNull()
    },
    table => ({
        uniqueLicenseRule: unique().on(table.licenseId, table.ruleId),
        projectIdIdx: index("license_violations_project_id_idx").on(table.projectId)
    })
);

export const autoFixSettings = sqliteTable(
    "auto_fix_settings",
    {
        id: text("id").primaryKey(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        enabled: integer("enabled").notNull(),
        upgradeTypes: text("upgrade_types").notNull(),
        groupingStrategy: text("grouping_strategy").notNull(),
        branchPrefix: text("branch_prefix").notNull(),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    table => ({
        uniqueProject: unique().on(table.projectId)
    })
);

export const autoFixPullRequests = sqliteTable(
    "auto_fix_pull_requests",
    {
        id: text("id").primaryKey(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        packageNames: text("package_names").notNull(),
        fromVersions: text("from_versions").notNull(),
        toVersions: text("to_versions").notNull(),
        upgradeType: text("upgrade_type").notNull(),
        branchName: text("branch_name").notNull(),
        prUrl: text("pr_url"),
        prNumber: integer("pr_number"),
        status: text("status").notNull(),
        licenseWarnings: text("license_warnings"),
        createdAt: integer("created_at").notNull(),
        updatedAt: integer("updated_at").notNull()
    },
    table => ({
        uniqueProjectBranch: unique().on(table.projectId, table.branchName)
    })
);

export const dependencyEdges = sqliteTable(
    "dependency_edges",
    {
        id: text("id").primaryKey(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        parentPackage: text("parent_package"),
        parentVersion: text("parent_version"),
        childPackage: text("child_package").notNull(),
        childVersion: text("child_version").notNull(),
        dependencyType: text("dependency_type").notNull(),
        depth: integer("depth").notNull(),
        scannedAt: integer("scanned_at").notNull()
    },
    table => ({
        projectIdIdx: index("dependency_edges_project_id_idx").on(table.projectId)
    })
);

export const licenseSnapshots = sqliteTable(
    "license_snapshots",
    {
        id: text("id").primaryKey(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        date: text("date").notNull(),
        totalPackages: integer("total_packages").notNull(),
        compliantCount: integer("compliant_count").notNull(),
        deniedCount: integer("denied_count").notNull(),
        warnedCount: integer("warned_count").notNull(),
        scannedAt: integer("scanned_at").notNull()
    },
    table => ({
        projectDateUnique: uniqueIndex("license_snapshots_project_date_unique").on(
            table.projectId,
            table.date
        )
    })
);

export const dependencyChanges = sqliteTable(
    "dependency_changes",
    {
        id: text("id").primaryKey(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        packageName: text("package_name").notNull(),
        changeType: text("change_type").notNull(),
        previousVersion: text("previous_version"),
        newVersion: text("new_version"),
        detectedAt: integer("detected_at").notNull()
    },
    table => ({
        projectIdIdx: index("dependency_changes_project_id_idx").on(table.projectId)
    })
);

export const teams = sqliteTable("teams", {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    color: text("color").notNull(),
    createdAt: integer("created_at").notNull()
});

export const teamProjects = sqliteTable(
    "team_projects",
    {
        id: text("id").primaryKey(),
        teamId: text("team_id")
            .notNull()
            .references(() => teams.id, { onDelete: "cascade" }),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" })
    },
    table => ({
        uniqueTeamProject: unique().on(table.teamId, table.projectId),
        projectIdIdx: index("team_projects_project_id_idx").on(table.projectId)
    })
);

export const users = sqliteTable("users", {
    id: text("id").primaryKey().notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    permission: text("permission").notNull().default("read-only"),
    isActive: integer("is_active").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull()
});

export const sessions = sqliteTable("sessions", {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull()
});

export const loginCodes = sqliteTable("login_codes", {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    type: text("type").notNull(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
    createdAt: integer("created_at").notNull()
});

export const nodeReleaseData = sqliteTable(
    "node_release_data",
    {
        id: text("id").primaryKey(),
        version: integer("version").notNull(),
        codename: text("codename"),
        releaseDate: integer("release_date").notNull(),
        ltsStart: integer("lts_start"),
        maintenanceStart: integer("maintenance_start"),
        eolDate: integer("eol_date").notNull(),
        fetchedAt: integer("fetched_at").notNull()
    },
    table => ({
        uniqueVersion: unique().on(table.version)
    })
);

export const engineChecks = sqliteTable(
    "engine_checks",
    {
        id: text("id").primaryKey(),
        projectId: text("project_id")
            .notNull()
            .references(() => projects.id, { onDelete: "cascade" }),
        packageName: text("package_name").notNull(),
        enginesNode: text("engines_node"),
        minimumMajor: integer("minimum_major"),
        status: text("status").notNull(),
        eolDate: integer("eol_date"),
        scannedAt: integer("scanned_at").notNull()
    },
    table => ({
        uniqueProjectPackage: unique().on(table.projectId, table.packageName)
    })
);
