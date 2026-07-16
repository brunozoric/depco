PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scan_results` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`current_version` text NOT NULL,
	`latest_version` text,
	`latest_in_range` text,
	`type` text NOT NULL,
	`upgrade_type` text,
	`dependency_kind` text DEFAULT 'dependency' NOT NULL,
	`registry_resolved` integer DEFAULT 1 NOT NULL,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_scan_results`("id", "project_id", "name", "current_version", "latest_version", "latest_in_range", "type", "upgrade_type", "scanned_at") SELECT "id", "project_id", "name", "current_version", "latest_version", "latest_in_range", "type", "upgrade_type", "scanned_at" FROM `scan_results`;--> statement-breakpoint
DROP TABLE `scan_results`;--> statement-breakpoint
ALTER TABLE `__new_scan_results` RENAME TO `scan_results`;--> statement-breakpoint
PRAGMA foreign_keys=ON;