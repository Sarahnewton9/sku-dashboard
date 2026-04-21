CREATE TABLE `last_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`status` enum('approved','waiting_revised') NOT NULL DEFAULT 'waiting_revised',
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `last_approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `last_approvals_lastName_unique` UNIQUE(`lastName`)
);
