CREATE TABLE `spec_custom_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL DEFAULT '__all__',
	`section` varchar(64) NOT NULL,
	`title` varchar(256) NOT NULL DEFAULT '',
	`value` text DEFAULT (''),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spec_custom_rows_id` PRIMARY KEY(`id`)
);
