CREATE TABLE `sales_rows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapshot_id` int NOT NULL,
	`style` varchar(128) NOT NULL,
	`colour` varchar(128) NOT NULL,
	`units` int NOT NULL DEFAULT 0,
	CONSTRAINT `sales_rows_id` PRIMARY KEY(`id`),
	CONSTRAINT `sales_row_idx` UNIQUE(`snapshot_id`,`style`,`colour`)
);
--> statement-breakpoint
CREATE TABLE `sales_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_snapshots_id` PRIMARY KEY(`id`)
);
