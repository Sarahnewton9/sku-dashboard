CREATE TABLE `sku_cost_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(64) NOT NULL DEFAULT '',
	`colour2` varchar(64) NOT NULL DEFAULT '',
	`leather2` varchar(64) NOT NULL DEFAULT '',
	`season` varchar(16) NOT NULL DEFAULT 'SS26',
	`cost` float NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sku_cost_prices_id` PRIMARY KEY(`id`),
	CONSTRAINT `sku_cost_prices_sku_season_unique` UNIQUE(`style`,`colour`,`leather`,`colour2`,`leather2`,`season`)
);
