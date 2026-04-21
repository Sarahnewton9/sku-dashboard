CREATE TABLE `fitting_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(64) NOT NULL DEFAULT '',
	`imageUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`uploadedBy` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fitting_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sku_meta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`leather` varchar(64) NOT NULL DEFAULT '',
	`sampleStatus` enum('waiting','received') NOT NULL DEFAULT 'waiting',
	`orderQty` int DEFAULT 0,
	`isSize11` boolean NOT NULL DEFAULT false,
	`costPrice` float,
	`fitRating` enum('tts','runs_small','runs_large'),
	`fittingNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sku_meta_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `style_meta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`rrp` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_meta_id` PRIMARY KEY(`id`),
	CONSTRAINT `style_meta_style_unique` UNIQUE(`style`)
);
