ALTER TABLE `spec_email_history` ADD `exportType` varchar(100) DEFAULT 'Specs' NOT NULL;--> statement-breakpoint
ALTER TABLE `spec_email_history` ADD `exportScope` varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `spec_email_history_export_scope_season_created_idx` ON `spec_email_history` (`exportType`,`exportScope`,`season`,`createdAt`);