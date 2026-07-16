ALTER TABLE `custom_lasts` DROP INDEX `custom_lasts_last_name_unique`;--> statement-breakpoint
ALTER TABLE `custom_lasts` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_lasts` ADD CONSTRAINT `custom_lasts_last_season_uniq` UNIQUE(`last_name`,`season`);