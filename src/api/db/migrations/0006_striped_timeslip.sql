CREATE INDEX `app_logs_project_id_idx` ON `app_logs` (`project_id`);--> statement-breakpoint
CREATE INDEX `dependency_changes_project_id_idx` ON `dependency_changes` (`project_id`);--> statement-breakpoint
CREATE INDEX `dependency_edges_project_id_idx` ON `dependency_edges` (`project_id`);--> statement-breakpoint
CREATE INDEX `license_policy_rules_project_id_idx` ON `license_policy_rules` (`project_id`);--> statement-breakpoint
CREATE INDEX `license_violations_project_id_idx` ON `license_violations` (`project_id`);--> statement-breakpoint
CREATE INDEX `project_step_hooks_project_id_idx` ON `project_step_hooks` (`project_id`);--> statement-breakpoint
CREATE INDEX `scan_results_project_id_idx` ON `scan_results` (`project_id`);--> statement-breakpoint
CREATE INDEX `security_checks_project_id_idx` ON `security_checks` (`project_id`);--> statement-breakpoint
CREATE INDEX `team_projects_project_id_idx` ON `team_projects` (`project_id`);--> statement-breakpoint
CREATE INDEX `upgrade_jobs_reference_id_idx` ON `upgrade_jobs` (`reference_id`);--> statement-breakpoint
CREATE INDEX `upgrade_jobs_status_idx` ON `upgrade_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `upgrade_jobs_parent_job_id_idx` ON `upgrade_jobs` (`parent_job_id`);--> statement-breakpoint
CREATE INDEX `upgrade_sessions_project_id_idx` ON `upgrade_sessions` (`project_id`);