CREATE TABLE `sku_new_override` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(64) NOT NULL DEFAULT '',
	`isNew` boolean NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sku_new_override_id` PRIMARY KEY(`id`)
);
