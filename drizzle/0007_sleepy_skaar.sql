CREATE TABLE `spec_dropdown_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`component` varchar(128) NOT NULL,
	`value` varchar(256) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spec_dropdown_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `style_spec_meta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`hasBuckle` boolean NOT NULL DEFAULT false,
	`dressShoeSubType` enum('court','sling'),
	`notes` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_spec_meta_id` PRIMARY KEY(`id`),
	CONSTRAINT `style_spec_meta_style_unique` UNIQUE(`style`)
);
--> statement-breakpoint
CREATE TABLE `style_specs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`component` varchar(128) NOT NULL,
	`value` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_specs_id` PRIMARY KEY(`id`)
);
