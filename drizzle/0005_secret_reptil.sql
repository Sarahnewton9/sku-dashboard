CREATE TABLE `style_fitting_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`imageUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `style_fitting_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `style_meta` ADD `fitRating` enum('tts','runs_small','runs_large');--> statement-breakpoint
ALTER TABLE `style_meta` ADD `fittingNotes` text;