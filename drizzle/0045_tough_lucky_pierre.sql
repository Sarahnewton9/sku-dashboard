ALTER TABLE `custom_styles` DROP INDEX `custom_styles_style_unique`;--> statement-breakpoint
ALTER TABLE `last_approvals` DROP INDEX `last_approvals_lastName_unique`;--> statement-breakpoint
ALTER TABLE `sku_new_override` DROP INDEX `sku_new_override_sku_idx`;--> statement-breakpoint
ALTER TABLE `spec_hidden_columns` DROP INDEX `spec_hidden_col_idx`;--> statement-breakpoint
ALTER TABLE `spec_row_order` DROP INDEX `spec_row_order_style_unique`;--> statement-breakpoint
ALTER TABLE `style_spec_meta` DROP INDEX `style_spec_meta_style_unique`;--> statement-breakpoint
ALTER TABLE `style_specs` DROP INDEX `style_colour_component_uniq`;--> statement-breakpoint
ALTER TABLE `buy_sessions` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_skus` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_styles` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `fitting_sessions` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `last_approvals` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `sku_new_override` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `spec_hidden_columns` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `spec_row_order` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `style_spec_meta` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `style_specs` ADD `season` varchar(16) DEFAULT 'SS26' NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_styles` ADD CONSTRAINT `custom_styles_style_season_uniq` UNIQUE(`style`,`season`);--> statement-breakpoint
ALTER TABLE `sku_new_override` ADD CONSTRAINT `sku_new_override_sku_idx` UNIQUE(`style`,`colour`,`leather`,`season`);--> statement-breakpoint
ALTER TABLE `spec_hidden_columns` ADD CONSTRAINT `spec_hidden_col_idx` UNIQUE(`style`,`colour`,`season`);--> statement-breakpoint
ALTER TABLE `style_specs` ADD CONSTRAINT `style_colour_component_uniq` UNIQUE(`style`,`colour`,`component`,`season`);