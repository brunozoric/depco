CREATE TABLE `app_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`source` text NOT NULL,
	`project_id` text,
	`message` text NOT NULL,
	`details` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auto_fix_pull_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`package_names` text NOT NULL,
	`from_versions` text NOT NULL,
	`to_versions` text NOT NULL,
	`upgrade_type` text NOT NULL,
	`branch_name` text NOT NULL,
	`pr_url` text,
	`pr_number` integer,
	`status` text NOT NULL,
	`license_warnings` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_fix_pull_requests_project_id_branch_name_unique` ON `auto_fix_pull_requests` (`project_id`,`branch_name`);--> statement-breakpoint
CREATE TABLE `auto_fix_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`enabled` integer NOT NULL,
	`upgrade_types` text NOT NULL,
	`grouping_strategy` text NOT NULL,
	`branch_prefix` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auto_fix_settings_project_id_unique` ON `auto_fix_settings` (`project_id`);--> statement-breakpoint
CREATE TABLE `changelogs` (
	`id` text PRIMARY KEY NOT NULL,
	`dependency_id` text NOT NULL,
	`dependency_version_id` text NOT NULL,
	`content` text,
	`source` text,
	`fetched_at` integer,
	FOREIGN KEY (`dependency_id`) REFERENCES `dependencies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dependency_version_id`) REFERENCES `dependency_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `changelogs_dependency_version_id_unique` ON `changelogs` (`dependency_version_id`);--> statement-breakpoint
CREATE TABLE `dependencies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`repo_url` text,
	`repo_directory` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dependencies_name_unique` ON `dependencies` (`name`);--> statement-breakpoint
CREATE TABLE `dependency_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`package_name` text NOT NULL,
	`change_type` text NOT NULL,
	`previous_version` text,
	`new_version` text,
	`detected_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dependency_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_package` text,
	`parent_version` text,
	`child_package` text NOT NULL,
	`child_version` text NOT NULL,
	`dependency_type` text NOT NULL,
	`depth` integer NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dependency_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`dependency_id` text NOT NULL,
	`version` text NOT NULL,
	`published_at` integer,
	FOREIGN KEY (`dependency_id`) REFERENCES `dependencies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dep_versions_dep_version_unique` ON `dependency_versions` (`dependency_id`,`version`);--> statement-breakpoint
CREATE TABLE `health_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`score` integer NOT NULL,
	`total_packages` integer NOT NULL,
	`up_to_date` integer NOT NULL,
	`patch_outdated` integer NOT NULL,
	`minor_outdated` integer NOT NULL,
	`major_outdated` integer NOT NULL,
	`scanned_at` integer NOT NULL,
	`vuln_critical` integer DEFAULT 0 NOT NULL,
	`vuln_high` integer DEFAULT 0 NOT NULL,
	`vuln_moderate` integer DEFAULT 0 NOT NULL,
	`vuln_low` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `health_snapshots_project_date_unique` ON `health_snapshots` (`project_id`,`date`);--> statement-breakpoint
CREATE TABLE `license_policy_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`license_pattern` text,
	`package_pattern` text,
	`project_id` text,
	`priority` integer NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `license_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`total_packages` integer NOT NULL,
	`compliant_count` integer NOT NULL,
	`denied_count` integer NOT NULL,
	`warned_count` integer NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `license_snapshots_project_date_unique` ON `license_snapshots` (`project_id`,`date`);--> statement-breakpoint
CREATE TABLE `license_violations` (
	`id` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`rule_id` text NOT NULL,
	`project_id` text NOT NULL,
	`package_name` text NOT NULL,
	`action` text NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rule_id`) REFERENCES `license_policy_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `license_violations_license_id_rule_id_unique` ON `license_violations` (`license_id`,`rule_id`);--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`package_name` text NOT NULL,
	`license_name` text NOT NULL,
	`spdx_id` text,
	`source` text NOT NULL,
	`risk_tier` text NOT NULL,
	`license_url` text,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_project_id_package_name_unique` ON `licenses` (`project_id`,`package_name`);--> statement-breakpoint
CREATE TABLE `osv_cache` (
	`package_name` text NOT NULL,
	`version` text NOT NULL,
	`data` text NOT NULL,
	`cached_at` integer NOT NULL,
	PRIMARY KEY(`package_name`, `version`)
);
--> statement-breakpoint
CREATE TABLE `pm_security_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`package_manager` text NOT NULL,
	`config_file` text NOT NULL,
	`field_name` text NOT NULL,
	`expected_value` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pm_security_settings_pm_config_field_unique` ON `pm_security_settings` (`package_manager`,`config_file`,`field_name`);--> statement-breakpoint
CREATE TABLE `project_step_hooks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`position` text NOT NULL,
	`name` text NOT NULL,
	`command` text NOT NULL,
	`type` text NOT NULL,
	`required` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'db' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`package_manager` text,
	`pm_version` text,
	`added_at` integer NOT NULL,
	`last_scanned_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_path_unique` ON `projects` (`path`);--> statement-breakpoint
CREATE TABLE `registry_cache` (
	`package_name` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_results` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`current_version` text NOT NULL,
	`latest_version` text NOT NULL,
	`latest_in_range` text NOT NULL,
	`type` text NOT NULL,
	`upgrade_type` text NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `scan_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`interval` text NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `scan_schedules_project_id_unique` ON `scan_schedules` (`project_id`);--> statement-breakpoint
CREATE TABLE `security_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`checked_at` integer NOT NULL,
	`results` text NOT NULL,
	`passes` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`project_id` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_projects_team_id_project_id_unique` ON `team_projects` (`team_id`,`project_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_name_unique` ON `teams` (`name`);--> statement-breakpoint
CREATE TABLE `upgrade_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_id` text NOT NULL,
	`reference_type` text DEFAULT 'project' NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`packages` text,
	`logs` text,
	`started_at` integer,
	`completed_at` integer,
	`warning` text
);
--> statement-breakpoint
CREATE TABLE `upgrade_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`current_step` text NOT NULL,
	`steps` text NOT NULL,
	`step_order` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `vulnerabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`package_name` text NOT NULL,
	`severity` text NOT NULL,
	`title` text NOT NULL,
	`advisory_url` text,
	`cve_id` text,
	`dedup_key` text NOT NULL,
	`vulnerable_range` text,
	`fix_version` text,
	`source` text NOT NULL,
	`installed_version` text,
	`scanned_at` integer NOT NULL,
	`dismissed_at` integer,
	`dismissed_until` integer,
	`dismissed_by` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vuln_project_package_dedup_unique` ON `vulnerabilities` (`project_id`,`package_name`,`dedup_key`);