CREATE TABLE `last_measurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`last_name` varchar(64) NOT NULL,
	`measure_type` enum('LENGTH','GIRTH') NOT NULL,
	`size` varchar(8) NOT NULL,
	`value` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `last_measurements_id` PRIMARY KEY(`id`),
	CONSTRAINT `last_type_size_idx` UNIQUE(`last_name`,`measure_type`,`size`)
);
--> statement-breakpoint
ALTER TABLE `style_trend_flags` MODIFY COLUMN `trends` text;