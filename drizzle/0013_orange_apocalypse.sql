CREATE TABLE `style_trend_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`trendFlag` varchar(64) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_trend_flags_id` PRIMARY KEY(`id`),
	CONSTRAINT `style_trend_flags_style_unique` UNIQUE(`style`)
);
