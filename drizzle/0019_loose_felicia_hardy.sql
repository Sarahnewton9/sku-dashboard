CREATE TABLE `deleted_lasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deleted_lasts_id` PRIMARY KEY(`id`),
	CONSTRAINT `deleted_lasts_lastName_unique` UNIQUE(`lastName`)
);
