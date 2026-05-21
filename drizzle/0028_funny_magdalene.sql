CREATE TABLE `spec_row_order` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`row_keys` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `spec_row_order_id` PRIMARY KEY(`id`),
	CONSTRAINT `spec_row_order_style_unique` UNIQUE(`style`)
);
