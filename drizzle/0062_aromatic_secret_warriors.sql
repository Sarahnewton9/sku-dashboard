CREATE TABLE IF NOT EXISTS `spec_email_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`season` varchar(16) NOT NULL,
	`recipients` text NOT NULL,
	`cc` text NOT NULL,
	`replyTo` varchar(320),
	`subject` varchar(255) NOT NULL,
	`attachmentFilename` varchar(255) NOT NULL,
	`resendEmailId` varchar(128),
	`sentByUserId` int,
	`sentByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spec_email_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `spec_email_recipient_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`recipients` text NOT NULL,
	`cc` text NOT NULL,
	`replyTo` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spec_email_recipient_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `spec_email_recipient_groups_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `spec_email_history_style_season_created_idx` ON `spec_email_history` (`style`,`season`,`createdAt`);
