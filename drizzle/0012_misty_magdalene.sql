CREATE TABLE `cancelled_skus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(64) NOT NULL DEFAULT '',
	`cancelledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cancelled_skus_id` PRIMARY KEY(`id`),
	CONSTRAINT `cancelled_skus_uniq` UNIQUE(`style`,`colour`,`leather`)
);
--> statement-breakpoint
CREATE TABLE `style_sub_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`subCategory` varchar(64) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_sub_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `style_sub_categories_style_unique` UNIQUE(`style`)
);
--> statement-breakpoint
ALTER TABLE `buy_session_items` ADD `auQty` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `buy_session_items` ADD `usaQty` int DEFAULT 0 NOT NULL;