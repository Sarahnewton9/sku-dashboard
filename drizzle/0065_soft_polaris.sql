ALTER TABLE `sku_meta` ADD `rrpOverride` float;--> statement-breakpoint
ALTER TABLE `style_meta` ADD `landedCost` float;--> statement-breakpoint
ALTER TABLE `style_meta` ADD `targetMargin` float DEFAULT 0.75 NOT NULL;--> statement-breakpoint
ALTER TABLE `style_meta` ADD `pricingSource` varchar(128);