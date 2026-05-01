CREATE TABLE `pptx_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`file_name` varchar(256) NOT NULL DEFAULT '',
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pptx_imports_id` PRIMARY KEY(`id`)
);
