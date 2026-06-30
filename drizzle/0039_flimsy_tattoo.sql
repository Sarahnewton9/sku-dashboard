CREATE TABLE `handbag_buy_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`style` varchar(128) NOT NULL,
	`colour` varchar(128) NOT NULL,
	`au_qty` int NOT NULL DEFAULT 0,
	`usa_qty` int NOT NULL DEFAULT 0,
	`nyc_qty` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `handbag_buy_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `handbag_buy_item_idx` UNIQUE(`session_id`,`style`,`colour`)
);
--> statement-breakpoint
CREATE TABLE `handbag_buy_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `handbag_buy_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `handbag_styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(128) NOT NULL,
	`colour` varchar(128) NOT NULL,
	`material` varchar(128),
	`section` varchar(128),
	`notes` varchar(512),
	`rrp` float,
	`cost` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `handbag_styles_id` PRIMARY KEY(`id`),
	CONSTRAINT `handbag_style_colour_idx` UNIQUE(`style`,`colour`)
);
--> statement-breakpoint
CREATE TABLE `markdown_skus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style_code` varchar(64) NOT NULL,
	`colour` varchar(128) NOT NULL,
	`product_title` varchar(256),
	`source_url` varchar(512),
	`flagged_at` timestamp NOT NULL DEFAULT (now()),
	`status` enum('pending','deleted','restored') NOT NULL DEFAULT 'pending',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `markdown_skus_id` PRIMARY KEY(`id`),
	CONSTRAINT `markdown_style_colour_idx` UNIQUE(`style_code`,`colour`)
);
