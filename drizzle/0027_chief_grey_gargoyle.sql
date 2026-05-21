CREATE TABLE `custom_styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`last_name` varchar(128) NOT NULL,
	`category` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_styles_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_styles_style_unique` UNIQUE(`style`)
);
