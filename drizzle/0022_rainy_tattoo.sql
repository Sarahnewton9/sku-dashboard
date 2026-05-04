CREATE TABLE `last_heel_heights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`last_name` varchar(128) NOT NULL,
	`heel_height_cm` float NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `last_heel_heights_id` PRIMARY KEY(`id`),
	CONSTRAINT `last_heel_heights_last_name_unique` UNIQUE(`last_name`)
);
