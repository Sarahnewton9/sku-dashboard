CREATE TABLE `handbag_style_parents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(128) NOT NULL,
	`seasonality` varchar(128),
	`notes` varchar(512),
	`style_image_url` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `handbag_style_parents_id` PRIMARY KEY(`id`),
	CONSTRAINT `handbag_style_parents_style_unique` UNIQUE(`style`)
);
--> statement-breakpoint
ALTER TABLE `handbag_styles` ADD `seasonality` varchar(128);
--> statement-breakpoint
INSERT INTO `handbag_style_parents` (`style`, `seasonality`, `notes`, `style_image_url`)
SELECT `style`, MAX(`section`), NULL, MAX(`style_image_url`)
FROM `handbag_styles`
GROUP BY `style`;
