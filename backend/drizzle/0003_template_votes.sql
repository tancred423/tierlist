CREATE TABLE `template_likes` (
	`template_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_likes_pk` PRIMARY KEY(`template_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `template_likes` ADD CONSTRAINT `template_likes_template_id_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `templates`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `template_likes` ADD CONSTRAINT `template_likes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
