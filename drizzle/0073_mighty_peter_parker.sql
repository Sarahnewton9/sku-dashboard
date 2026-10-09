ALTER TABLE `cancelled_skus` DROP INDEX `cancelled_skus_season_uniq`;--> statement-breakpoint
ALTER TABLE `cancelled_skus` ADD `colour2` varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cancelled_skus` ADD `leather2` varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cancelled_skus` ADD CONSTRAINT `cancelled_skus_composite_season_uniq` UNIQUE(`style`,`colour`,`leather`,`colour2`,`leather2`,`season`);