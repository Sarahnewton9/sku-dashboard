CREATE TABLE `fitting_group_styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`style` varchar(64) NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fitting_group_styles_id` PRIMARY KEY(`id`),
	CONSTRAINT `fitting_group_styles_uniq` UNIQUE(`groupId`,`style`)
);
--> statement-breakpoint
CREATE TABLE `fitting_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`sessionDate` varchar(32) NOT NULL DEFAULT '',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fitting_groups_id` PRIMARY KEY(`id`)
);
