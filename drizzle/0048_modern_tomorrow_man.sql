CREATE TABLE `colour_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`colour_description` varchar(128) NOT NULL,
	`colour_code` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `colour_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `colour_codes_colour_description_unique` UNIQUE(`colour_description`)
);
