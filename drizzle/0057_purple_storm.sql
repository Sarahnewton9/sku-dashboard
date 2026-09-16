ALTER TABLE `cancelled_skus` DROP INDEX `cancelled_skus_uniq`;--> statement-breakpoint
ALTER TABLE `cancelled_styles` DROP INDEX `cancelled_styles_style_unique`;--> statement-breakpoint
ALTER TABLE `cancelled_skus` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `cancelled_styles` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `cancelled_skus` ADD CONSTRAINT `cancelled_skus_season_uniq` UNIQUE(`style`,`colour`,`leather`,`season`);--> statement-breakpoint
ALTER TABLE `cancelled_styles` ADD CONSTRAINT `cancelled_styles_style_season_uniq` UNIQUE(`style`,`season`);