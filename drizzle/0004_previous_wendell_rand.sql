CREATE TABLE `season_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(128) NOT NULL,
	`rowCount` int NOT NULL DEFAULT 0,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `season_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `season_sku_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importId` int NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(128) NOT NULL DEFAULT '',
	`colourDescription` varchar(128) NOT NULL DEFAULT '',
	`subCategory` varchar(64),
	`auOrigPrice` float,
	`totalUnitsSold` int NOT NULL DEFAULT 0,
	`lastWeekUnits` int NOT NULL DEFAULT 0,
	`lastWeekSellThru` float NOT NULL DEFAULT 0,
	`avgWeeklySellThru` float NOT NULL DEFAULT 0,
	`stdSellThru` float,
	`totalSoh` int NOT NULL DEFAULT 0,
	CONSTRAINT `season_sku_data_id` PRIMARY KEY(`id`)
);
