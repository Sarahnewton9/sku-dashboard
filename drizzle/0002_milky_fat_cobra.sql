CREATE TABLE `buy_session_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(64) NOT NULL DEFAULT '',
	`qty` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buy_session_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `buy_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`isLocked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lockedAt` timestamp,
	CONSTRAINT `buy_sessions_id` PRIMARY KEY(`id`)
);
