CREATE TABLE `fitting_session_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`style` varchar(64) NOT NULL,
	`imageUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fitting_session_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fitting_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`fitModel` varchar(128) NOT NULL DEFAULT '',
	`sessionDate` varchar(32) NOT NULL DEFAULT '',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fitting_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `style_image_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`imageUrl` text NOT NULL,
	`fileKey` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `style_image_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `style_image_overrides_style_unique` UNIQUE(`style`)
);
