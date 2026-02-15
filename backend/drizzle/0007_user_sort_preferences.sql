ALTER TABLE `users` ADD COLUMN `tierlist_sort` VARCHAR(20) DEFAULT 'updated_desc';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `template_sort` VARCHAR(20) DEFAULT 'updated_desc';
