ALTER TABLE `deleted_lasts` DROP INDEX `deleted_lasts_lastName_unique`;--> statement-breakpoint
ALTER TABLE `deleted_lasts` ADD CONSTRAINT `deleted_lasts_last_season_uniq` UNIQUE(`lastName`,`season`);