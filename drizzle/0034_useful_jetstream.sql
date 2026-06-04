CREATE TABLE `custom_lasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`last_name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_lasts_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_lasts_last_name_unique` UNIQUE(`last_name`)
);
