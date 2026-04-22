CREATE TABLE `cancelled_styles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`cancelledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cancelled_styles_id` PRIMARY KEY(`id`),
	CONSTRAINT `cancelled_styles_style_unique` UNIQUE(`style`)
);
