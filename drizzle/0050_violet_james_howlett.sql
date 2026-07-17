CREATE TABLE `ap21_colour_refs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colourKey` varchar(64) NOT NULL,
	`upperMaterial` varchar(64),
	`soleMaterial` varchar(64),
	`liningMaterial` varchar(64),
	`season` varchar(64),
	`productStatus` varchar(64),
	`fabrication` varchar(64),
	`iconic` varchar(64),
	`webColourGroup` varchar(64),
	`occasion` varchar(64),
	`web` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ap21_colour_refs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ap21_colour_refs_idx` UNIQUE(`style`,`colourKey`)
);
--> statement-breakpoint
CREATE TABLE `ap21_style_refs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`rangeType` varchar(64),
	`toeShape` varchar(64),
	`upperHeight` varchar(64),
	`countryOfOrigin` varchar(64),
	`supplier` varchar(128),
	`hsCode` varchar(64),
	`season` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ap21_style_refs_id` PRIMARY KEY(`id`),
	CONSTRAINT `ap21_style_refs_style_unique` UNIQUE(`style`)
);
