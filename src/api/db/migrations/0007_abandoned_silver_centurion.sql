CREATE TABLE `engine_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`package_name` text NOT NULL,
	`engines_node` text,
	`minimum_major` integer,
	`status` text NOT NULL,
	`eol_date` integer,
	`scanned_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `engine_checks_project_id_package_name_unique` ON `engine_checks` (`project_id`,`package_name`);--> statement-breakpoint
CREATE TABLE `node_release_data` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`codename` text,
	`release_date` integer NOT NULL,
	`lts_start` integer,
	`maintenance_start` integer,
	`eol_date` integer NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `node_release_data_version_unique` ON `node_release_data` (`version`);