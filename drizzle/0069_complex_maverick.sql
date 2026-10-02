ALTER TABLE `buy_session_items` ADD `colour2` varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `buy_session_items` ADD `leather2` varchar(64) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `buy_session_items` ADD CONSTRAINT `buy_session_items_sku_identity_unique` UNIQUE(`sessionId`,`style`,`colour`,`leather`,`colour2`,`leather2`);