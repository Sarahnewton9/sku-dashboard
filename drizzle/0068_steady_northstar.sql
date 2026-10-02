CREATE TABLE `ap21_sku_colour_descriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(64) NOT NULL DEFAULT '',
	`colour2` varchar(64) NOT NULL DEFAULT '',
	`leather2` varchar(64) NOT NULL DEFAULT '',
	`ap21_colour_description` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ap21_sku_colour_descriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ap21_sku_colour_descriptions_identity_unique` UNIQUE(`style`,`colour`,`leather`,`colour2`,`leather2`)
);
