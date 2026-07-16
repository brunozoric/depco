ALTER TABLE `vulnerabilities` ADD `dependency_kind` text DEFAULT 'dependency' NOT NULL;
--> statement-breakpoint
UPDATE vulnerabilities
SET dependency_kind = COALESCE(
    (SELECT sr.dependency_kind FROM scan_results sr
     WHERE sr.project_id = vulnerabilities.project_id
     AND sr.name = vulnerabilities.package_name
     LIMIT 1),
    'dependency'
);