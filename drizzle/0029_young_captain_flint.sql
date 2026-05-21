CREATE TABLE `spec_hidden_columns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`style` varchar(64) NOT NULL,
	`colour` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `spec_hidden_columns_id` PRIMARY KEY(`id`),
	CONSTRAINT `spec_hidden_col_idx` UNIQUE(`style`,`colour`)
);
