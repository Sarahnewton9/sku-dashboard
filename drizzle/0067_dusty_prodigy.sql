ALTER TABLE `last_approvals` ADD CONSTRAINT `last_approvals_last_season_uniq` UNIQUE(`lastName`,`season`);
